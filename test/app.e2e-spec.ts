import { Test, TestingModule } from '@nestjs/testing';
import { Body, Controller, Get, INestApplication, Post } from '@nestjs/common';
import { IsInt, Min } from 'class-validator';
import request from 'supertest';
import { App } from 'supertest/types';
import { setupApplication } from './../src/app.setup.js';
import { AppModule } from './../src/app.module.js';

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

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [TestPipelineController],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApplication(app);
    await app.init();
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

  afterEach(async () => {
    if (app) await app.close();
  });
});
