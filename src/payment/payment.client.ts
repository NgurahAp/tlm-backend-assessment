import {
  BadGatewayException,
  GatewayTimeoutException,
  HttpException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Prisma } from '../generated/prisma/client.js';
import { CandidateHeaderService } from './candidate-header.service.js';
import {
  PAYMENT_FETCH,
  type PaymentFetch,
  type PaymentInquiryPayload,
  type PaymentInquiryResult,
  type PaymentPayPayload,
  type PaymentStatusResult,
} from './payment.types.js';

type PaymentOperation = 'inquiry' | 'pay' | 'status';

interface PaymentRequestOptions<T> {
  operation: PaymentOperation;
  path: string;
  method: 'GET' | 'POST';
  requestId: string;
  orderNumber?: string;
  transactionId?: string;
  body?: unknown;
  parse: (body: unknown) => T;
}

@Injectable()
export class PaymentClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(
    config: ConfigService,
    private readonly candidateHeader: CandidateHeaderService,
    @Inject(PAYMENT_FETCH) private readonly fetcher: PaymentFetch,
    @InjectPinoLogger(PaymentClient.name)
    private readonly logger: PinoLogger,
  ) {
    this.baseUrl = config
      .getOrThrow<string>('app.paymentBaseUrl')
      .replace(/\/+$/, '');
    this.timeoutMs = config.getOrThrow<number>('app.externalApiTimeoutMs');
  }

  inquiry(
    payload: PaymentInquiryPayload,
    requestId: string,
  ): Promise<PaymentInquiryResult> {
    return this.request({
      operation: 'inquiry',
      path: '/inquiry',
      method: 'POST',
      requestId,
      orderNumber: payload.order_id,
      body: payload,
      parse: (body) => this.parseInquiry(body, payload.amount),
    });
  }

  pay(
    payload: PaymentPayPayload,
    requestId: string,
  ): Promise<PaymentStatusResult> {
    return this.request({
      operation: 'pay',
      path: '/pay',
      method: 'POST',
      requestId,
      transactionId: payload.transaction_id,
      body: payload,
      parse: (body) =>
        this.parseStatus(body, payload.transaction_id, payload.amount),
    });
  }

  status(
    transactionId: string,
    expectedAmount: number,
    requestId: string,
  ): Promise<PaymentStatusResult> {
    return this.request({
      operation: 'status',
      path: `/status/${encodeURIComponent(transactionId)}`,
      method: 'GET',
      requestId,
      transactionId,
      parse: (body) => this.parseStatus(body, transactionId, expectedAmount),
    });
  }

  private async request<T>(options: PaymentRequestOptions<T>): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let externalStatusCode: number | undefined;
    const logContext = {
      requestId: options.requestId,
      orderNumber: options.orderNumber,
      transactionId: options.transactionId,
      externalService: 'payment',
      operation: options.operation,
    };

    this.logger.info(
      { ...logContext, event: `payment.${options.operation}.started` },
      `Payment ${options.operation} started`,
    );

    try {
      const response = await this.fetcher(`${this.baseUrl}${options.path}`, {
        method: options.method,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'X-CANDIDATES-NAME': this.candidateHeader.getValue(),
          'X-Request-Id': options.requestId,
        },
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });
      externalStatusCode = response.status;

      if (!response.ok) {
        throw new BadGatewayException({
          code: 'PAYMENT_UPSTREAM_ERROR',
          message: 'Payment service returned an unsuccessful response',
        });
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw this.invalidResponse();
      }

      const result = options.parse(body);
      this.logger.info(
        {
          ...logContext,
          event: `payment.${options.operation}.succeeded`,
          externalStatusCode: response.status,
        },
        `Payment ${options.operation} succeeded`,
      );
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        this.logFailure(
          options.operation,
          {
            ...logContext,
            externalStatusCode,
          },
          error,
        );
        throw error;
      }

      if (this.isAbortError(error)) {
        const timeoutError = new GatewayTimeoutException({
          code: 'PAYMENT_TIMEOUT',
          message: 'Payment service request timed out',
        });
        this.logFailure(options.operation, logContext, timeoutError);
        throw timeoutError;
      }

      const upstreamError = new BadGatewayException({
        code: 'PAYMENT_UPSTREAM_ERROR',
        message: 'Payment service could not be reached',
      });
      this.logFailure(options.operation, logContext, upstreamError, error);
      throw upstreamError;
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseInquiry(
    value: unknown,
    expectedAmount: number,
  ): PaymentInquiryResult {
    const data = this.unwrap(value);
    const transactionId = this.readTransactionId(data);
    const amount = this.readAmount(data, expectedAmount);
    return { transactionId, amount };
  }

  private parseStatus(
    value: unknown,
    expectedTransactionId: string,
    expectedAmount: number,
  ): PaymentStatusResult {
    const data = this.unwrap(value);
    const transactionId = this.readTransactionId(data);
    const amount = this.readAmount(data, expectedAmount);
    const status = data.status;

    if (transactionId !== expectedTransactionId) throw this.invalidResponse();
    if (
      typeof status !== 'string' ||
      status.trim().length === 0 ||
      status.length > 30
    ) {
      throw this.invalidResponse();
    }

    return { transactionId, amount, status: status.trim().toUpperCase() };
  }

  private unwrap(value: unknown): Record<string, unknown> {
    if (typeof value !== 'object' || value === null)
      throw this.invalidResponse();
    const response = value as Record<string, unknown>;
    const candidate =
      typeof response.data === 'object' && response.data !== null
        ? response.data
        : response;
    return candidate as Record<string, unknown>;
  }

  private readTransactionId(data: Record<string, unknown>): string {
    const value = data.transaction_id;
    if (
      typeof value !== 'string' ||
      value.trim().length === 0 ||
      value.length > 100
    ) {
      throw this.invalidResponse();
    }
    return value.trim();
  }

  private readAmount(
    data: Record<string, unknown>,
    expectedAmount: number,
  ): string {
    if (typeof data.amount !== 'number' && typeof data.amount !== 'string') {
      throw this.invalidResponse();
    }

    try {
      const amount = new Prisma.Decimal(data.amount);
      const expected = new Prisma.Decimal(expectedAmount);
      if (
        !amount.isFinite() ||
        amount.lessThanOrEqualTo(0) ||
        !amount.equals(expected)
      ) {
        throw this.invalidResponse();
      }
      return amount.toFixed(2);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw this.invalidResponse();
    }
  }

  private invalidResponse(): BadGatewayException {
    return new BadGatewayException({
      code: 'PAYMENT_INVALID_RESPONSE',
      message: 'Payment service returned an invalid response',
    });
  }

  private isAbortError(error: unknown): boolean {
    return (
      error instanceof Error &&
      (error.name === 'AbortError' || error.name === 'TimeoutError')
    );
  }

  private logFailure(
    operation: PaymentOperation,
    context: Record<string, unknown>,
    error: Error,
    cause?: unknown,
  ): void {
    this.logger.warn(
      {
        ...context,
        event: `payment.${operation}.failed`,
        err: cause ?? error,
      },
      `Payment ${operation} failed`,
    );
  }
}
