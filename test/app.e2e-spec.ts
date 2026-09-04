import { Test, TestingModule } from '@nestjs/testing';
import { Body, Controller, Get, INestApplication, Post } from '@nestjs/common';
import { IsInt, Min } from 'class-validator';
import request from 'supertest';
import { App } from 'supertest/types';
import { setupApplication } from './../src/app.setup.js';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

class TestRequestDto {
  @IsInt()
  @Min(1)
  quantity!: number;
}

@Controller('__test')
class TestPipelineController {
  @Post('validate')
  validate(@Body() body: TestRequestDto): TestRequestDto {
    return body;
  }

  @Get('error')
  error(): never {
    throw new Error('Internal implementation detail');
  }
}

describe('Application foundation (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let orderWithItemsId: number;
  let orderWithoutItemsId: number;
  const orderPrefix = `E2E-PHASE14-${process.pid}-`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [TestPipelineController],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApplication(app);
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.order.deleteMany({
      where: { orderNumber: { startsWith: orderPrefix } },
    });

    const orderWithItems = await prisma.order.create({
      data: {
        orderNumber: `${orderPrefix}001`,
        paymentMethod: 'Credit Card',
        status: 'E2E_READY',
        subtotal: '2000000.00',
        discount: '10.00',
        grandTotal: '1800000.00',
        orderDate: new Date('2026-07-01T03:00:00.000Z'),
        items: {
          create: {
            productName: 'Huawei Smart Watch',
            quantity: 1,
            subtotal: '2000000.00',
          },
        },
      },
    });
    const orderWithoutItems = await prisma.order.create({
      data: {
        orderNumber: `${orderPrefix}002`,
        paymentMethod: 'Bank Transfer',
        status: 'E2E_EMPTY',
        subtotal: '1000000.00',
        discount: '0.00',
        grandTotal: '1000000.00',
        orderDate: new Date('2026-07-02T03:00:00.000Z'),
      },
    });

    orderWithItemsId = orderWithItems.id;
    orderWithoutItemsId = orderWithoutItems.id;
  });

  it('/health (GET) returns health and a generated request ID', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(response.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(response.body).toMatchObject({
      success: true,
      data: {
        status: 'ok',
        service: 'tlm-backend-assessment',
      },
      requestId: response.headers['x-request-id'],
    });
    expect(Number.isNaN(Date.parse(response.body.data.timestamp))).toBe(false);
    expect(response.body.data.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('/docs serves Swagger UI', async () => {
    const response = await request(app.getHttpServer())
      .get('/docs')
      .expect(200);

    expect(response.headers['content-type']).toContain('text/html');
    expect(response.headers['x-request-id']).toBeDefined();
    expect(response.text).toContain('Lumiere Backend Assessment API');
  });

  it('/docs-json serves the OpenAPI document', async () => {
    const response = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);

    expect(response.body.info).toMatchObject({
      title: 'Lumiere Backend Assessment API',
      version: '1.0.0',
    });
    expect(response.headers['x-request-id']).toBeDefined();
    expect(response.body.paths).toHaveProperty('/health');
    expect(response.body.paths).toHaveProperty('/orders');
    expect(response.body.paths).toHaveProperty('/orders/{id}');
    expect(response.body.paths).toHaveProperty('/orders/{id}/items');
  });

  it('/orders (GET) supports pagination and exact status filtering', async () => {
    const requestId = 'orders-list-request-123';
    const response = await request(app.getHttpServer())
      .get('/orders?page=1&limit=1&status=E2E_READY')
      .set('X-Request-Id', requestId)
      .expect(200);

    expect(response.headers['x-request-id']).toBe(requestId);
    expect(response.body).toMatchObject({
      success: true,
      data: [
        {
          id: orderWithItemsId,
          order_number: `${orderPrefix}001`,
          payment_method: 'Credit Card',
          status: 'E2E_READY',
          subtotal: '2000000.00',
          discount: '10.00',
          grand_total: '1800000.00',
        },
      ],
      meta: { page: 1, limit: 1, total: 1, totalPages: 1 },
      requestId,
    });
    expect(Number.isNaN(Date.parse(response.body.data[0].order_date))).toBe(
      false,
    );
  });

  it('/orders/:id (GET) returns an order and its items', async () => {
    const response = await request(app.getHttpServer())
      .get(`/orders/${orderWithItemsId}`)
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: {
        id: orderWithItemsId,
        order_number: `${orderPrefix}001`,
        items: [
          {
            order_id: orderWithItemsId,
            product_name: 'Huawei Smart Watch',
            quantity: 1,
            subtotal: '2000000.00',
          },
        ],
      },
      requestId: response.headers['x-request-id'],
    });
  });

  it('/orders/:id/items (GET) returns items or an empty list', async () => {
    const populated = await request(app.getHttpServer())
      .get(`/orders/${orderWithItemsId}/items`)
      .expect(200);
    const empty = await request(app.getHttpServer())
      .get(`/orders/${orderWithoutItemsId}/items`)
      .expect(200);

    expect(populated.body.data).toEqual([
      expect.objectContaining({
        order_id: orderWithItemsId,
        product_name: 'Huawei Smart Watch',
      }),
    ]);
    expect(empty.body.data).toEqual([]);
  });

  it('rejects a non-positive order ID', async () => {
    const response = await request(app.getHttpServer())
      .get('/orders/0')
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Request validation failed',
      },
      path: '/orders/0',
    });
    expect(response.body.error.details).toContain('id must not be less than 1');
  });

  it('returns ORDER_NOT_FOUND for an unknown order ID', async () => {
    const requestId = 'missing-order-request-123';
    const response = await request(app.getHttpServer())
      .get('/orders/2147483647')
      .set('X-Request-Id', requestId)
      .expect(404);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'ORDER_NOT_FOUND',
        message: 'Order with ID 2147483647 was not found',
        details: [],
      },
      requestId,
      path: '/orders/2147483647',
    });
  });

  it('returns a consistent error containing the incoming request ID', async () => {
    const requestId = 'assessment-request-123';
    const response = await request(app.getHttpServer())
      .get('/unknown')
      .set('X-Request-Id', requestId)
      .expect(404);

    expect(response.headers['x-request-id']).toBe(requestId);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Cannot GET /unknown',
        details: [],
      },
      requestId,
      timestamp: expect.any(String),
      path: '/unknown',
    });
    expect(Number.isNaN(Date.parse(response.body.timestamp))).toBe(false);
  });

  it('formats global validation failures consistently', async () => {
    const requestId = 'validation-request-123';
    const response = await request(app.getHttpServer())
      .post('/__test/validate')
      .set('X-Request-Id', requestId)
      .send({ quantity: 0, unexpected: true })
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Request validation failed',
      },
      requestId,
      path: '/__test/validate',
    });
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([
        'property unexpected should not exist',
        'quantity must not be less than 1',
      ]),
    );
  });

  it('hides internal error details from the client', async () => {
    const requestId = 'internal-error-request-123';
    const response = await request(app.getHttpServer())
      .get('/__test/error')
      .set('X-Request-Id', requestId)
      .expect(500);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
        details: [],
      },
      requestId,
      path: '/__test/error',
    });
    expect(JSON.stringify(response.body)).not.toContain(
      'Internal implementation detail',
    );
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.order.deleteMany({
        where: { orderNumber: { startsWith: orderPrefix } },
      });
    }
    if (app) await app.close();
  });
});
