import type { ConfigService } from '@nestjs/config';
import type { IncomingMessage, ServerResponse } from 'node:http';
import pino, { type LevelWithSilent, type TransportTargetOptions } from 'pino';
import type { Params } from 'nestjs-pino';
import { resolveRequestId } from './request-id.js';

export const REDACTED_LOG_VALUE = '[Redacted]';

export const REDACTED_LOG_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-candidates-name"]',
  'req.body.password',
  'req.body.token',
  'req.body.accessToken',
  'req.body.refreshToken',
  'req.body.cardNumber',
  'req.body.cvv',
  'res.headers["set-cookie"]',
  'authorization',
  'cookie',
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'cardNumber',
  'cvv',
  'DATABASE_URL',
  'databaseUrl',
] as const;

export function createLoggerOptions(config: ConfigService): Params {
  const level = config.getOrThrow<LevelWithSilent>('logging.level');
  const logFile = config.getOrThrow<string>('logging.file');
  const pretty = config.getOrThrow<boolean>('logging.pretty');
  const service = config.getOrThrow<string>('app.serviceName');
  const environment = config.getOrThrow<string>('app.nodeEnv');

  const targets: TransportTargetOptions[] = [
    pretty
      ? {
          target: 'pino-pretty',
          level,
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : {
          target: 'pino/file',
          level,
          options: { destination: 1 },
        },
    {
      target: 'pino/file',
      level,
      options: {
        destination: logFile,
        mkdir: true,
      },
    },
  ];

  return {
    pinoHttp: {
      level,
      timestamp: pino.stdTimeFunctions.isoTime,
      base: undefined,
      transport: { targets },
      redact: {
        paths: [...REDACTED_LOG_PATHS],
        censor: REDACTED_LOG_VALUE,
      },
      customProps: (request: IncomingMessage) => ({
        service,
        environment,
        requestId: String(request.id),
      }),
      customAttributeKeys: {
        reqId: 'requestId',
        responseTime: 'latencyMs',
      },
      genReqId: resolveRequestId,
      customLogLevel: (
        _request: IncomingMessage,
        response: ServerResponse,
        error?: Error,
      ) => {
        if (error || response.statusCode >= 500) return 'error';
        if (response.statusCode >= 400) return 'warn';
        return 'info';
      },
      customReceivedMessage: (request: IncomingMessage) =>
        `${request.method} ${request.url} received`,
      customSuccessMessage: (
        request: IncomingMessage,
        response: ServerResponse,
      ) =>
        `${request.method} ${request.url} completed (${response.statusCode})`,
      customErrorMessage: (
        request: IncomingMessage,
        response: ServerResponse,
      ) => `${request.method} ${request.url} failed (${response.statusCode})`,
    },
  };
}
