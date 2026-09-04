import type { ConfigService } from '@nestjs/config';
import { HttpException } from '@nestjs/common';
import type { PinoLogger } from 'nestjs-pino';
import { InventoryClient } from './inventory.client.js';
import type { InventoryFetch } from './inventory.types.js';

function createClient(
  fetcher: InventoryFetch,
  timeoutMs = 100,
): InventoryClient {
  const config = {
    getOrThrow: (key: string) => {
      if (key === 'app.inventoryBaseUrl')
        return 'https://inventory.test/api/v1/';
      if (key === 'app.externalApiTimeoutMs') return timeoutMs;
      throw new Error(`Unexpected config key: ${key}`);
    },
  } as ConfigService;
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
  } as unknown as PinoLogger;

  return new InventoryClient(config, fetcher, logger);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('InventoryClient', () => {
  it('maps a valid inventory response', async () => {
    const fetcher = vi.fn<InventoryFetch>().mockResolvedValue(
      jsonResponse({
        success: true,
        data: { product_name: 'Huawei Smart Watch', stock: 378 },
      }),
    );
    const client = createClient(fetcher);

    await expect(client.getById(1, 'request-1')).resolves.toEqual({
      inventoryId: 1,
      productName: 'Huawei Smart Watch',
      stock: 378,
    });
    expect(fetcher).toHaveBeenCalledWith(
      'https://inventory.test/api/v1/1',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(fetcher).toHaveBeenCalledWith(
      'https://inventory.test/api/v1/1',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Request-Id': 'request-1',
        }),
      }),
    );
  });

  it('rejects an invalid upstream response', async () => {
    const client = createClient(
      vi.fn<InventoryFetch>().mockResolvedValue(
        jsonResponse({
          success: true,
          data: { product_name: '', stock: -1 },
        }),
      ),
    );

    await expect(client.getById(1, 'request-1')).rejects.toMatchObject({
      status: 502,
      response: { code: 'INVENTORY_INVALID_RESPONSE' },
    });
  });

  it('maps a missing inventory item to 404', async () => {
    const client = createClient(
      vi.fn<InventoryFetch>().mockResolvedValue(jsonResponse({}, 404)),
    );

    await expect(client.getById(99, 'request-1')).rejects.toMatchObject({
      status: 404,
      response: { code: 'INVENTORY_NOT_FOUND' },
    });
  });

  it('maps an upstream failure to 502', async () => {
    const client = createClient(
      vi.fn<InventoryFetch>().mockResolvedValue(jsonResponse({}, 500)),
    );

    await expect(client.getById(1, 'request-1')).rejects.toMatchObject({
      status: 502,
      response: { code: 'INVENTORY_UPSTREAM_ERROR' },
    });
  });

  it('maps an aborted request to 504', async () => {
    const fetcher: InventoryFetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Request aborted', 'AbortError'));
        });
      });
    const client = createClient(fetcher, 5);

    try {
      await client.getById(1, 'request-1');
      throw new Error('Expected request to time out');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error).toMatchObject({
        status: 504,
        response: { code: 'INVENTORY_TIMEOUT' },
      });
    }
  });
});
