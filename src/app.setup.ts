import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';
import { Logger } from 'nestjs-pino';
import { resolveRequestId } from './common/logging/request-id.js';
import { setupSwagger } from './docs/swagger.js';

export function setupApplication(app: INestApplication): void {
  const logger = app.get(Logger);
  const config = app.get(ConfigService);
  const service = config.getOrThrow<string>('app.serviceName');
  const environment = config.getOrThrow<string>('app.nodeEnv');

  app.use((request: Request, response: Response, next: NextFunction) => {
    const requestId = resolveRequestId(request, response);
    request.id = requestId;
    const startedAt = process.hrtime.bigint();

    response.once('finish', () => {
      if (request.log !== undefined) return;

      const latencyMs = Math.round(
        Number(process.hrtime.bigint() - startedAt) / 1_000_000,
      );
      const context = {
        event: 'http.request.completed',
        service,
        environment,
        requestId,
        method: request.method,
        path: request.originalUrl,
        statusCode: response.statusCode,
        latencyMs,
        msg: `${request.method} ${request.originalUrl} completed (${response.statusCode})`,
      };

      if (response.statusCode >= 500) logger.error(context);
      else if (response.statusCode >= 400) logger.warn(context);
      else logger.log(context);
    });

    next();
  });

  setupSwagger(app);
}
