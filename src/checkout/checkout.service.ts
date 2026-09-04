import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { Order, OrderItem } from '../generated/prisma/client.js';
import { Prisma } from '../generated/prisma/client.js';
import { InventoryClient } from '../inventory/inventory.client.js';
import { PaymentService } from '../payment/payment.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { OrderDetailDataDto } from '../orders/dto/order-response.dto.js';
import type { CheckoutDataDto } from './dto/checkout-response.dto.js';
import type { CheckoutRequestDto } from './dto/checkout-request.dto.js';
import { CheckoutCalculatorService } from './checkout-calculator.service.js';
import { OrderNumberService } from './order-number.service.js';

interface PreparedItem {
  inventoryId: number;
  productName: string;
  quantity: number;
  subtotal: Prisma.Decimal;
}

type PersistedOrder = Order & { items: OrderItem[] };

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryClient,
    private readonly calculator: CheckoutCalculatorService,
    private readonly orderNumbers: OrderNumberService,
    private readonly payments: PaymentService,
    @InjectPinoLogger(CheckoutService.name)
    private readonly logger: PinoLogger,
  ) {}

  async checkout(
    input: CheckoutRequestDto,
    requestId: string,
  ): Promise<CheckoutDataDto> {
    this.logger.info(
      {
        event: 'checkout.received',
        requestId,
        itemCount: input.items.length,
      },
      'Checkout request received',
    );

    try {
      const items = await this.prepareItems(input, requestId);
      const totals = this.calculator.calculate(items, input.discount);
      const now = new Date();
      const order = await this.persistOrder(input, items, totals, now);

      this.logger.info(
        {
          event: 'checkout.persisted',
          requestId,
          orderId: order.id,
          orderNumber: order.orderNumber,
          itemCount: order.items.length,
          grandTotal: order.grandTotal.toFixed(2),
        },
        'Checkout order persisted',
      );

      const payment = await this.payments.process(order, requestId);

      this.logger.info(
        {
          event: 'checkout.completed',
          requestId,
          orderId: order.id,
          orderNumber: order.orderNumber,
          transactionId: payment.transactionId,
          status: payment.status,
        },
        'Checkout and payment completed',
      );

      return {
        ...this.toOrderDetail({ ...order, status: payment.status }),
        transaction_id: payment.transactionId,
      };
    } catch (error) {
      const context = {
        event: 'checkout.failed',
        requestId,
        errorCode: this.getErrorCode(error),
      };

      if (error instanceof HttpException && error.getStatus() < 500) {
        this.logger.warn(context, 'Checkout rejected');
        throw error;
      }

      this.logger.error({ ...context, err: error }, 'Checkout failed');

      if (error instanceof HttpException) throw error;
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException({
          code: 'ORDER_NUMBER_CONFLICT',
          message: 'The generated order number is already in use',
        });
      }

      throw new InternalServerErrorException({
        code: 'CHECKOUT_PERSISTENCE_FAILED',
        message: 'Checkout could not be saved',
      });
    }
  }

  private async prepareItems(
    input: CheckoutRequestDto,
    requestId: string,
  ): Promise<PreparedItem[]> {
    return Promise.all(
      input.items.map(async (item) => {
        const inventory = await this.inventory.getById(
          item.inventory_id,
          requestId,
        );

        if (item.quantity > inventory.stock) {
          throw new UnprocessableEntityException({
            code: 'INVENTORY_OUT_OF_STOCK',
            message: `Inventory item ${item.inventory_id} does not have enough stock`,
          });
        }

        const subtotal = new Prisma.Decimal(item.subtotal).toDecimalPlaces(2);
        if (subtotal.lessThanOrEqualTo(0)) {
          throw new BadRequestException({
            code: 'INVALID_ITEM_SUBTOTAL',
            message: 'Item subtotal must be greater than zero',
          });
        }

        return {
          inventoryId: item.inventory_id,
          productName: inventory.productName,
          quantity: item.quantity,
          subtotal,
        };
      }),
    );
  }

  private async persistOrder(
    input: CheckoutRequestDto,
    items: PreparedItem[],
    totals: ReturnType<CheckoutCalculatorService['calculate']>,
    now: Date,
  ): Promise<PersistedOrder> {
    const maximumAttempts = 3;

    for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (transaction) => {
          const orderNumber = await this.orderNumbers.next(transaction, now);

          return transaction.order.create({
            data: {
              orderNumber,
              paymentMethod: input.payment_method,
              status: 'Pending',
              subtotal: totals.subtotal,
              discount: totals.discount,
              grandTotal: totals.grandTotal,
              orderDate: now,
              items: {
                create: items.map((item) => ({
                  productName: item.productName,
                  quantity: item.quantity,
                  subtotal: item.subtotal,
                })),
              },
            },
            include: { items: { orderBy: { id: 'asc' } } },
          });
        });
      } catch (error) {
        if (!this.isUniqueConstraintError(error)) throw error;
        if (attempt === maximumAttempts) {
          throw new ConflictException({
            code: 'ORDER_NUMBER_CONFLICT',
            message: 'The generated order number is already in use',
          });
        }
      }
    }

    throw new ConflictException({
      code: 'ORDER_NUMBER_CONFLICT',
      message: 'The generated order number is already in use',
    });
  }

  private toOrderDetail(order: PersistedOrder): OrderDetailDataDto {
    return {
      id: order.id,
      order_number: order.orderNumber,
      payment_method: order.paymentMethod,
      status: order.status,
      subtotal: order.subtotal.toFixed(2),
      discount: order.discount.toFixed(2),
      grand_total: order.grandTotal.toFixed(2),
      order_date: order.orderDate.toISOString(),
      created_at: order.createdAt.toISOString(),
      updated_at: order.updatedAt.toISOString(),
      items: order.items.map((item) => ({
        id: item.id,
        order_id: item.orderId,
        product_name: item.productName,
        quantity: item.quantity,
        subtotal: item.subtotal.toFixed(2),
        created_at: item.createdAt.toISOString(),
        updated_at: item.updatedAt.toISOString(),
      })),
    };
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }

  private getErrorCode(error: unknown): string {
    if (!(error instanceof HttpException)) return 'CHECKOUT_PERSISTENCE_FAILED';
    const response = error.getResponse();
    if (
      typeof response !== 'object' ||
      response === null ||
      !('code' in response)
    ) {
      return error.name;
    }
    return String(response.code);
  }
}
