import Joi from 'joi';

export const environmentValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  SERVICE_NAME: Joi.string().trim().min(1).default('tlm-backend-assessment'),
  INVENTORY_BASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('https://assessment.lumiere.dev/api/v1/inventory'),
  PAYMENT_BASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('https://assessment.lumiere.dev/api/v1/payment'),
  EXTERNAL_API_TIMEOUT_MS: Joi.number().integer().positive().default(5000),
  CANDIDATE_NAME: Joi.string().allow('').default(''),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required(),
  LOG_LEVEL: Joi.string()
    .valid('trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent')
    .default('debug'),
  LOG_FILE: Joi.string().trim().min(1).default('logs/debug.log'),
  LOG_PRETTY: Joi.boolean().truthy('true').falsy('false').default(true),
  LOG_MAX_SIZE_MB: Joi.number().integer().positive().default(10),
  LOG_MAX_FILES: Joi.number().integer().positive().default(5),
});
