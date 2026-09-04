import type { ConfigService } from '@nestjs/config';
import type { PinoLogger } from 'nestjs-pino';
import type { CandidateHeaderService } from './candidate-header.service.js';
import { PaymentClient } from './payment.client.js';
import type { PaymentFetch } from './payment.types.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function createClient(fetcher: PaymentFetch, timeoutMs = 100): PaymentClient {
  const config = {
    getOrThrow: (key: string) => {
      if (key === 'app.paymentBaseUrl') return 'https://payment.test/api/v1/';
      if (key === 'app.externalApiTimeoutMs') return timeoutMs;
      throw new Error(`Unexpected config key: ${key}`);
    },
  } as ConfigService;
  const candidateHeader = {
    getValue: () => 'dGVzdF9jYW5kaWRhdGU=',
  } as CandidateHeaderService;
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
  } as unknown as PinoLogger;

  return new PaymentClient(config, candidateHeader, fetcher, logger);
}

describe('PaymentClient', () => {
  it('sends the candidate header and validates inquiry response', async () => {
    const fetcher = vi
      .fn<PaymentFetch>()
      .mockResolvedValue(
        jsonResponse({ transaction_id: 'TRX_123', amount: 900000 }),
      );
    const client = createClient(fetcher);

    await expect(
      client.inquiry(
        { order_id: 'ORD-202609-001', amount: 900000 },
        'request-1',
      ),
    ).resolves.toEqual({ transactionId: 'TRX_123', amount: '900000.00' });
    expect(fetcher).toHaveBeenCalledWith(
      'https://payment.test/api/v1/inquiry',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-CANDIDATES-NAME': 'dGVzdF9jYW5kaWRhdGU=',
          'X-Request-Id': 'request-1',
        }),
      }),
    );
  });

  it('accepts a wrapped pay response and normalizes status', async () => {
    const client = createClient(
      vi.fn<PaymentFetch>().mockResolvedValue(
        jsonResponse({
          success: true,
          data: { transaction_id: 'TRX_123', status: 'paid', amount: 90 },
        }),
      ),
    );

    await expect(
      client.pay(
        {
          transaction_id: 'TRX_123',
          items: [{ product_name: 'Watch', quantity: 1, subtotal: 100 }],
          discount: 10,
          amount: 90,
        },
        'request-1',
      ),
    ).resolves.toEqual({
      transactionId: 'TRX_123',
      status: 'PAID',
      amount: '90.00',
    });
  });

  it('rejects mismatched amount or transaction ID', async () => {
    const client = createClient(
      vi.fn<PaymentFetch>().mockResolvedValue(
        jsonResponse({
          transaction_id: 'TRX_OTHER',
          status: 'PAID',
          amount: 91,
        }),
      ),
    );

    await expect(
      client.status('TRX_123', 90, 'request-1'),
    ).rejects.toMatchObject({
      status: 502,
      response: { code: 'PAYMENT_INVALID_RESPONSE' },
    });
  });

  it('maps a timeout to 504', async () => {
    const fetcher: PaymentFetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Request aborted', 'AbortError'));
        });
      });
    const client = createClient(fetcher, 5);

    await expect(
      client.inquiry({ order_id: 'ORD-202609-001', amount: 90 }, 'request-1'),
    ).rejects.toMatchObject({
      status: 504,
      response: { code: 'PAYMENT_TIMEOUT' },
    });
  });
});
