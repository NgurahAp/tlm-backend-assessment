import { environmentValidationSchema } from './env.validation.js';

describe('environmentValidationSchema', () => {
  it('provides safe defaults when a database URL is supplied', () => {
    const { error, value } = environmentValidationSchema.validate({
      DATABASE_URL: 'postgresql://user:password@localhost:5432/database',
    });

    expect(error).toBeUndefined();
    expect(value).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      SERVICE_NAME: 'tlm-backend-assessment',
      EXTERNAL_API_TIMEOUT_MS: 5000,
      LOG_LEVEL: 'debug',
      LOG_FILE: 'logs/debug.log',
      LOG_PRETTY: true,
      LOG_MAX_SIZE_MB: 10,
      LOG_MAX_FILES: 5,
    });
    expect(value.DATABASE_URL).toBe(
      'postgresql://user:password@localhost:5432/database',
    );
  });

  it('rejects invalid log rotation limits', () => {
    const { error } = environmentValidationSchema.validate({
      DATABASE_URL: 'postgresql://postgres:password@localhost:5432/lumiere',
      LOG_MAX_SIZE_MB: 0,
      LOG_MAX_FILES: -1,
    });

    expect(error).toBeDefined();
  });

  it('requires a PostgreSQL database URL', () => {
    const { error } = environmentValidationSchema.validate({});

    expect(error?.message).toContain('DATABASE_URL');
  });

  it('rejects invalid non-database configuration', () => {
    const { error } = environmentValidationSchema.validate(
      {
        NODE_ENV: 'staging',
        PORT: 'invalid',
        EXTERNAL_API_TIMEOUT_MS: 0,
        LOG_LEVEL: 'verbose',
      },
      { abortEarly: false },
    );

    expect(error).toBeDefined();
    expect(error?.message).toContain('NODE_ENV');
    expect(error?.message).toContain('PORT');
    expect(error?.message).toContain('EXTERNAL_API_TIMEOUT_MS');
    expect(error?.message).toContain('LOG_LEVEL');
  });
});
