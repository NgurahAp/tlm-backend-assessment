import {
  BadGatewayException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { Order, OrderItem, Payment } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PaymentClient } from './payment.client.js';
import type { ProcessedPayment } from './payment.types.js';

type PayableOrder = Order & { items: OrderItem[] };

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly client: PaymentClient,
    @InjectPinoLogger(PaymentService.name)
    private readonly logger: PinoLogger,
  ) {}

  async process(
    order: PayableOrder,
    requestId: string,
  ): Promise<ProcessedPayment> {
    const existing = await this.prisma.payment.findUnique({
      where: { orderId: order.id },
    });

    if (existing !== null) return this.handleExisting(existing);

    const payment = await this.createPaymentRecord(order);
    try {
      const inquiry = await this.client.inquiry(
        {
          order_id: order.orderNumber,
          amount: order.grandTotal.toNumber(),
        },
        requestId,
      );

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          transactionId: inquiry.transactionId,
          status: 'PAYMENT_PROCESSING',
          inquiryAt: new Date(),
          externalResponse: {
            operation: 'inquiry',
            transaction_id: inquiry.transactionId,
            amount: inquiry.amount,
          },
        },
      });

      const payResult = await this.client.pay(
        {
          transaction_id: inquiry.transactionId,
          items: order.items.map((item) => ({
            product_name: item.productName,
            quantity: item.quantity,
            subtotal: item.subtotal.toNumber(),
          })),
          discount: order.discount.toNumber(),
          amount: order.grandTotal.toNumber(),
        },
        requestId,
      );

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: payResult.status,
          externalResponse: {
            operation: 'pay',
            transaction_id: payResult.transactionId,
            status: payResult.status,
            amount: payResult.amount,
          },
        },
      });

      const verified = await this.client.status(
        inquiry.transactionId,
        order.grandTotal.toNumber(),
        requestId,
      );

      if (verified.status !== 'PAID') {
        throw new BadGatewayException({
          code: 'PAYMENT_NOT_PAID',
          message: `Payment status is ${verified.status}`,
        });
      }

      await this.prisma.$transaction([
        this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'PAID',
            paidAt: new Date(),
            failureCode: null,
            failureMessage: null,
            externalResponse: {
              operation: 'status',
              transaction_id: verified.transactionId,
              status: verified.status,
              amount: verified.amount,
            },
          },
        }),
        this.prisma.order.update({
          where: { id: order.id },
          data: { status: 'PAID' },
        }),
      ]);

      this.logger.info(
        {
          event: 'payment.completed',
          requestId,
          orderId: order.id,
          orderNumber: order.orderNumber,
          transactionId: verified.transactionId,
          status: verified.status,
          amount: verified.amount,
        },
        'Payment completed and order status updated',
      );

      return {
        transactionId: verified.transactionId,
        status: 'PAID',
        amount: verified.amount,
      };
    } catch (error) {
      await this.markFailed(payment.id, order.id, error, requestId);
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException({
        code: 'PAYMENT_PROCESSING_FAILED',
        message: 'Payment could not be processed',
      });
    }
  }

  private async createPaymentRecord(order: PayableOrder): Promise<Payment> {
    try {
      return await this.prisma.payment.create({
        data: {
          orderId: order.id,
          status: 'INQUIRY_PENDING',
          amount: order.grandTotal,
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException({
          code: 'PAYMENT_ALREADY_STARTED',
          message: 'Payment has already been started for this order',
        });
      }
      throw error;
    }
  }

  private handleExisting(payment: Payment): ProcessedPayment {
    if (payment.status === 'PAID' && payment.transactionId !== null) {
      return {
        transactionId: payment.transactionId,
        status: 'PAID',
        amount: payment.amount.toFixed(2),
      };
    }

    throw new ConflictException({
      code: 'PAYMENT_ALREADY_STARTED',
      message: 'Payment has already been started for this order',
    });
  }

  private async markFailed(
    paymentId: number,
    orderId: number,
    error: unknown,
    requestId: string,
  ): Promise<void> {
    const errorCode = this.getErrorCode(error);
    const errorMessage = this.getErrorMessage(error).slice(0, 255);

    try {
      await this.prisma.$transaction([
        this.prisma.payment.update({
          where: { id: paymentId },
          data: {
            status: 'PAYMENT_FAILED',
            failureCode: errorCode.slice(0, 60),
            failureMessage: errorMessage,
          },
        }),
        this.prisma.order.update({
          where: { id: orderId },
          data: { status: 'PAYMENT_FAILED' },
        }),
      ]);
    } catch (persistenceError) {
      this.logger.error(
        {
          event: 'payment.failure_persistence.failed',
          requestId,
          orderId,
          paymentId,
          errorCode,
          err: persistenceError,
        },
        'Failed to persist payment failure state',
      );
    }

    this.logger.error(
      {
        event: 'payment.failed',
        requestId,
        orderId,
        paymentId,
        errorCode,
        err: error,
      },
      errorMessage,
    );
  }

  private getErrorCode(error: unknown): string {
    if (!(error instanceof HttpException)) return 'PAYMENT_PROCESSING_FAILED';
    const response = error.getResponse();
    if (
      typeof response === 'object' &&
      response !== null &&
      'code' in response
    ) {
      return String(response.code);
    }
    return error.name;
  }

  private getErrorMessage(error: unknown): string {
    if (!(error instanceof HttpException)) return 'Payment processing failed';
    const response = error.getResponse();
    if (
      typeof response === 'object' &&
      response !== null &&
      'message' in response
    ) {
      return String(response.message);
    }
    return error.message;
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}
