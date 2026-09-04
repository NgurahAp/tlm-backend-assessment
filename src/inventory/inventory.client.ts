import {
  BadGatewayException,
  GatewayTimeoutException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  INVENTORY_FETCH,
  type InventoryFetch,
  type InventoryItem,
} from './inventory.types.js';

interface InventoryApiResponse {
  success: true;
  data: {
    product_name: string;
    stock: number;
  };
}

@Injectable()
export class InventoryClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(
    config: ConfigService,
    @Inject(INVENTORY_FETCH) private readonly fetcher: InventoryFetch,
    @InjectPinoLogger(InventoryClient.name)
    private readonly logger: PinoLogger,
  ) {
    this.baseUrl = config
      .getOrThrow<string>('app.inventoryBaseUrl')
      .replace(/\/+$/, '');
    this.timeoutMs = config.getOrThrow<number>('app.externalApiTimeoutMs');
  }

  async getById(
    inventoryId: number,
    requestId: string,
  ): Promise<InventoryItem> {
    const url = `${this.baseUrl}/${inventoryId}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    this.logger.info(
      {
        event: 'inventory.check.started',
        requestId,
        inventoryId,
        externalService: 'inventory',
      },
      'Checking inventory availability',
    );

    try {
      const response = await this.fetcher(url, {
        method: 'GET',
        headers: { accept: 'application/json' },
        signal: controller.signal,
      });

      if (response.status === 404) {
        throw new NotFoundException({
          code: 'INVENTORY_NOT_FOUND',
          message: `Inventory item ${inventoryId} was not found`,
        });
      }

      if (!response.ok) {
        throw new BadGatewayException({
          code: 'INVENTORY_UPSTREAM_ERROR',
          message: 'Inventory service returned an unsuccessful response',
        });
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new BadGatewayException({
          code: 'INVENTORY_INVALID_RESPONSE',
          message: 'Inventory service returned an invalid response',
        });
      }
      if (!this.isValidResponse(body)) {
        throw new BadGatewayException({
          code: 'INVENTORY_INVALID_RESPONSE',
          message: 'Inventory service returned an invalid response',
        });
      }

      const inventory: InventoryItem = {
        inventoryId,
        productName: body.data.product_name,
        stock: body.data.stock,
      };

      this.logger.info(
        {
          event: 'inventory.check.succeeded',
          requestId,
          inventoryId,
          stock: inventory.stock,
          externalService: 'inventory',
          externalStatusCode: response.status,
        },
        'Inventory availability retrieved',
      );

      return inventory;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadGatewayException
      ) {
        this.logFailure(error, requestId, inventoryId);
        throw error;
      }

      if (this.isAbortError(error)) {
        const timeoutError = new GatewayTimeoutException({
          code: 'INVENTORY_TIMEOUT',
          message: 'Inventory service request timed out',
        });
        this.logFailure(timeoutError, requestId, inventoryId);
        throw timeoutError;
      }

      const upstreamError = new BadGatewayException({
        code: 'INVENTORY_UPSTREAM_ERROR',
        message: 'Inventory service could not be reached',
      });
      this.logFailure(upstreamError, requestId, inventoryId, error);
      throw upstreamError;
    } finally {
      clearTimeout(timeout);
    }
  }

  private isValidResponse(value: unknown): value is InventoryApiResponse {
    if (typeof value !== 'object' || value === null) return false;

    const response = value as Record<string, unknown>;
    if (response.success !== true) return false;
    if (typeof response.data !== 'object' || response.data === null)
      return false;

    const data = response.data as Record<string, unknown>;
    return (
      typeof data.product_name === 'string' &&
      data.product_name.trim().length > 0 &&
      data.product_name.length <= 255 &&
      typeof data.stock === 'number' &&
      Number.isInteger(data.stock) &&
      data.stock >= 0
    );
  }

  private isAbortError(error: unknown): boolean {
    return (
      error instanceof Error &&
      (error.name === 'AbortError' || error.name === 'TimeoutError')
    );
  }

  private logFailure(
    error: Error,
    requestId: string,
    inventoryId: number,
    cause?: unknown,
  ): void {
    this.logger.warn(
      {
        event: 'inventory.check.failed',
        requestId,
        inventoryId,
        externalService: 'inventory',
        err: cause ?? error,
      },
      error.message,
    );
  }
}
