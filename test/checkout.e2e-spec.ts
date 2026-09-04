import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { setupApplication } from '../src/app.setup.js';
import {
  INVENTORY_FETCH,
  type InventoryFetch,
} from '../src/inventory/inventory.types.js';
import { CandidateHeaderService } from '../src/payment/candidate-header.service.js';
import {
  PAYMENT_FETCH,
  type PaymentFetch,
} from '../src/payment/payment.types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

function inventoryResponse(inventoryId: number): Response {
  const inventories: Record<number, { product_name: string; stock: number }> = {
    1: { product_name: 'Huawei Smart Watch', stock: 378 },
    2: { product_name: 'Iphone 17 Pro', stock: 29 },
    3: { product_name: 'Samsung S24', stock: 0 },
  };
  const inventory = inventories[inventoryId];

  if (inventory === undefined) {
    return new Response(JSON.stringify({ success: false }), { status: 404 });
  }

  return new Response(
    JSON.stringify({
      success: true,
      module: 'Inventory',
      method: 'get-by-id',
      message: 'Inventory retrieved successfully',
      data: inventory,
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

describe('Checkout (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const createdOrderIds: number[] = [];
  const paymentAmounts = new Map<string, number>();
  let paymentSequence = 0;
  let failedOrderNumber: string | undefined;
  const inventoryFetch = vi.fn<InventoryFetch>(async (input) => {
    const url = new URL(String(input));
    return inventoryResponse(Number(url.pathname.split('/').at(-1)));
  });
  const paymentFetch = vi.fn<PaymentFetch>(async (input, init) => {
    const url = new URL(String(input));
    const body =
      typeof init?.body === 'string'
        ? (JSON.parse(init.body) as Record<string, unknown>)
        : undefined;

    if (url.pathname.endsWith('/inquiry')) {
      const amount = Number(body?.amount);
      if (amount === 555.55) {
        failedOrderNumber = String(body?.order_id);
        return new Response(
          JSON.stringify({ message: 'Payment unavailable' }),
          {
            status: 503,
          },
        );
      }
      paymentSequence += 1;
      const transactionId = `TRX_TEST_${paymentSequence}`;
      paymentAmounts.set(transactionId, amount);
      return new Response(
        JSON.stringify({ transaction_id: transactionId, amount }),
        { status: 200 },
      );
    }

    if (url.pathname.endsWith('/pay')) {
      return new Response(
        JSON.stringify({
          transaction_id: body?.transaction_id,
          status: 'PAID',
          amount: body?.amount,
        }),
        { status: 200 },
      );
    }

    const transactionId = decodeURIComponent(url.pathname.split('/').at(-1)!);
    return new Response(
      JSON.stringify({
        transaction_id: transactionId,
        status: 'PAID',
        amount: paymentAmounts.get(transactionId),
      }),
      { status: 200 },
    );
  });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(INVENTORY_FETCH)
      .useValue(inventoryFetch)
      .overrideProvider(PAYMENT_FETCH)
      .useValue(paymentFetch)
      .overrideProvider(CandidateHeaderService)
      .useValue({ getValue: () => 'dGVzdF9jYW5kaWRhdGU=' })
      .compile();

    app = moduleFixture.createNestApplication();
    setupApplication(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  it('documents POST /checkout in Swagger', async () => {
    const response = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);

    expect(response.body.paths).toHaveProperty('/checkout');
    expect(response.body.paths['/checkout']).toHaveProperty('post');
    const checkout = response.body.paths['/checkout'].post;
    expect(
      checkout.requestBody.content['application/json'].examples,
    ).toHaveProperty('availableInventory');
    expect(
      checkout.requestBody.content['application/json'].examples,
    ).toHaveProperty('unavailableInventory');
    expect(checkout.responses).toMatchObject({
      201: expect.any(Object),
      400: expect.any(Object),
      404: expect.any(Object),
      409: expect.any(Object),
      422: expect.any(Object),
      500: expect.any(Object),
      502: expect.any(Object),
      504: expect.any(Object),
    });
  });

  it('creates an order atomically after checking inventory IDs 1 and 2', async () => {
    const requestId = 'checkout-success-001';
    const response = await request(app.getHttpServer())
      .post('/checkout')
      .set('X-Request-Id', requestId)
      .send({
        payment_method: 'Credit Card',
        discount: 10,
        items: [
          { inventory_id: 1, quantity: 1, subtotal: 2000000 },
          { inventory_id: 2, quantity: 1, subtotal: 1000000 },
        ],
      })
      .expect(201);

    createdOrderIds.push(response.body.data.id);
    expect(response.headers['x-request-id']).toBe(requestId);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        payment_method: 'Credit Card',
        status: 'PAID',
        subtotal: '3000000.00',
        discount: '10.00',
        grand_total: '2700000.00',
        items: [
          {
            product_name: 'Huawei Smart Watch',
            quantity: 1,
            subtotal: '2000000.00',
          },
          {
            product_name: 'Iphone 17 Pro',
            quantity: 1,
            subtotal: '1000000.00',
          },
        ],
      },
      requestId,
    });
    expect(response.body.data.transaction_id).toMatch(/^TRX_TEST_\d+$/);
    expect(response.body.data.order_number).toMatch(/^ORD-\d{6}-\d{3}$/);

    const stored = await prisma.order.findUnique({
      where: { id: response.body.data.id },
      include: { items: true },
    });
    expect(stored?.items).toHaveLength(2);
    expect(stored?.status).toBe('PAID');
    await expect(
      prisma.payment.findUnique({ where: { orderId: response.body.data.id } }),
    ).resolves.toMatchObject({ status: 'PAID' });

    const readableOrder = await request(app.getHttpServer())
      .get(`/orders/${response.body.data.id}`)
      .expect(200);
    expect(readableOrder.body.data).toMatchObject({
      id: response.body.data.id,
      order_number: response.body.data.order_number,
      items: [
        { product_name: 'Huawei Smart Watch' },
        { product_name: 'Iphone 17 Pro' },
      ],
    });
  });

  it('uses discount zero when the field is omitted', async () => {
    const response = await request(app.getHttpServer())
      .post('/checkout')
      .send({
        payment_method: 'Bank Transfer',
        items: [{ inventory_id: 1, quantity: 1, subtotal: 100.05 }],
      })
      .expect(201);

    createdOrderIds.push(response.body.data.id);
    expect(response.body.data).toMatchObject({
      discount: '0.00',
      subtotal: '100.05',
      grand_total: '100.05',
    });
  });

  it('rejects inventory ID 3 because its stock is zero', async () => {
    const response = await request(app.getHttpServer())
      .post('/checkout')
      .send({
        payment_method: 'Credit Card',
        items: [{ inventory_id: 3, quantity: 1, subtotal: 1000000 }],
      })
      .expect(422);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'INVENTORY_OUT_OF_STOCK',
        message: 'Inventory item 3 does not have enough stock',
      },
      path: '/checkout',
    });
  });

  it('persists an auditable failure when the payment API fails', async () => {
    const response = await request(app.getHttpServer())
      .post('/checkout')
      .set('X-Request-Id', 'checkout-payment-failure-001')
      .send({
        payment_method: 'Credit Card',
        items: [{ inventory_id: 1, quantity: 1, subtotal: 555.55 }],
      })
      .expect(502);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'PAYMENT_UPSTREAM_ERROR',
        message: 'Payment service returned an unsuccessful response',
      },
      requestId: 'checkout-payment-failure-001',
    });
    expect(failedOrderNumber).toBeDefined();

    const failedOrder = await prisma.order.findUnique({
      where: { orderNumber: failedOrderNumber },
      include: { payment: true },
    });
    expect(failedOrder).toMatchObject({
      status: 'PAYMENT_FAILED',
      payment: {
        status: 'PAYMENT_FAILED',
        failureCode: 'PAYMENT_UPSTREAM_ERROR',
      },
    });
    if (failedOrder !== null) createdOrderIds.push(failedOrder.id);
  });

  it('rejects duplicate inventory IDs and unknown fields', async () => {
    const response = await request(app.getHttpServer())
      .post('/checkout')
      .send({
        payment_method: 'Credit Card',
        unexpected: true,
        items: [
          { inventory_id: 1, quantity: 1, subtotal: 100 },
          { inventory_id: 1, quantity: 2, subtotal: 200 },
        ],
      })
      .expect(400);

    expect(response.body.error).toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Request validation failed',
    });
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([
        'property unexpected should not exist',
        'items must not contain duplicate inventory_id values',
      ]),
    );
  });

  it('rejects a blank payment method', async () => {
    const response = await request(app.getHttpServer())
      .post('/checkout')
      .send({
        payment_method: '   ',
        items: [{ inventory_id: 1, quantity: 1, subtotal: 100 }],
      })
      .expect(400);

    expect(response.body.error.details).toContain(
      'payment_method should not be empty',
    );
  });

  it('generates distinct monthly order numbers for concurrent checkouts', async () => {
    const body = {
      payment_method: 'Credit Card',
      items: [{ inventory_id: 1, quantity: 1, subtotal: 100 }],
    };
    const [first, second] = await Promise.all([
      request(app.getHttpServer()).post('/checkout').send(body),
      request(app.getHttpServer()).post('/checkout').send(body),
    ]);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    createdOrderIds.push(first.body.data.id, second.body.data.id);
    expect(first.body.data.order_number).not.toBe(
      second.body.data.order_number,
    );
  });

  afterAll(async () => {
    if (prisma && createdOrderIds.length > 0) {
      await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    }
    if (app) await app.close();
  });
});
