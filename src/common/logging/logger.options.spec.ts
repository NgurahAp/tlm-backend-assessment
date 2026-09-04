import pino from 'pino';
import { REDACTED_LOG_PATHS, REDACTED_LOG_VALUE } from './logger.options.js';

describe('logger redaction', () => {
  it('redacts secrets from structured log objects', () => {
    let output = '';
    const databaseUrl = [
      'postgresql://user',
      'redaction-test-only@localhost:5432/database',
    ].join(':');
    const logger = pino(
      {
        redact: {
          paths: [...REDACTED_LOG_PATHS],
          censor: REDACTED_LOG_VALUE,
        },
      },
      { write: (chunk: string) => (output += chunk) },
    );

    logger.info({
      password: 'secret',
      DATABASE_URL: databaseUrl,
      req: {
        headers: {
          authorization: 'Bearer token',
          cookie: 'session=secret',
          'x-candidates-name': 'candidate-secret',
        },
        body: {
          cardNumber: '4111111111111111',
          cvv: '123',
        },
      },
    });

    const log = JSON.parse(output) as Record<string, unknown>;
    const request = log.req as {
      headers: Record<string, string>;
      body: Record<string, string>;
    };

    expect(log.password).toBe(REDACTED_LOG_VALUE);
    expect(log.DATABASE_URL).toBe(REDACTED_LOG_VALUE);
    expect(request.headers.authorization).toBe(REDACTED_LOG_VALUE);
    expect(request.headers.cookie).toBe(REDACTED_LOG_VALUE);
    expect(request.headers['x-candidates-name']).toBe(REDACTED_LOG_VALUE);
    expect(request.body.cardNumber).toBe(REDACTED_LOG_VALUE);
    expect(request.body.cvv).toBe(REDACTED_LOG_VALUE);
    expect(output).not.toContain('4111111111111111');
    expect(output).not.toContain('redaction-test-only');
    expect(output).not.toContain('candidate-secret');
  });
});
