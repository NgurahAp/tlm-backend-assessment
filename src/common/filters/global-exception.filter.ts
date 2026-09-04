import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  REQUEST_ID_RESPONSE_HEADER,
  resolveRequestId,
} from '../logging/request-id.js';

interface NestErrorPayload {
  code?: string;
  message?: string | string[];
}

interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details: string[];
  };
  requestId: string;
  timestamp: string;
  path: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    @InjectPinoLogger(GlobalExceptionFilter.name)
    private readonly logger: PinoLogger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = this.getPayload(exception);
    const { message, details } = this.getPublicMessage(
      exception,
      payload,
      statusCode,
    );
    const errorCode =
      payload.code ?? HttpStatus[statusCode] ?? 'INTERNAL_SERVER_ERROR';
    const requestId = this.getRequestId(request, response);
    const path = request.originalUrl ?? request.url;
    const logContext = {
      event:
        statusCode >= 500 ? 'http.request.failed' : 'http.request.rejected',
      requestId,
      method: request.method,
      path,
      statusCode,
      errorCode,
    };

    if (statusCode >= 500) {
      this.logger.error(
        { ...logContext, err: exception },
        'Unhandled HTTP request error',
      );
    } else {
      this.logger.warn(logContext, message);
    }

    const body: ApiErrorResponse = {
      success: false,
      error: {
        code: errorCode,
        message,
        details,
      },
      requestId,
      timestamp: new Date().toISOString(),
      path,
    };

    response.status(statusCode).json(body);
  }

  private getPayload(exception: unknown): NestErrorPayload {
    if (!(exception instanceof HttpException)) return {};

    const response = exception.getResponse();
    if (typeof response === 'string') return { message: response };
    return response as NestErrorPayload;
  }

  private getPublicMessage(
    exception: unknown,
    payload: NestErrorPayload,
    statusCode: number,
  ): { message: string; details: string[] } {
    if (statusCode >= 500) {
      return { message: 'Internal server error', details: [] };
    }

    if (Array.isArray(payload.message)) {
      return {
        message: 'Request validation failed',
        details: payload.message,
      };
    }

    return {
      message:
        payload.message ??
        (exception instanceof Error ? exception.message : 'Request failed'),
      details: [],
    };
  }

  private getRequestId(request: Request, response: Response): string {
    if (request.id !== undefined) return String(request.id);

    const existingHeader = response.getHeader(REQUEST_ID_RESPONSE_HEADER);
    if (typeof existingHeader === 'string') return existingHeader;

    return resolveRequestId(request, response);
  }
}
