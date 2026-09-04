import { registerAs } from '@nestjs/config';

export interface AppConfiguration {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  serviceName: string;
  inventoryBaseUrl: string;
  paymentBaseUrl: string;
  externalApiTimeoutMs: number;
  candidateName: string;
}

const appConfig = registerAs('app', (): AppConfiguration => ({
  nodeEnv: (process.env.NODE_ENV ??
    'development') as AppConfiguration['nodeEnv'],
  port: Number(process.env.PORT ?? 3000),
  serviceName: process.env.SERVICE_NAME ?? 'tlm-backend-assessment',
  inventoryBaseUrl:
    process.env.INVENTORY_BASE_URL ??
    'https://assessment.lumiere.dev/api/v1/inventory',
  paymentBaseUrl:
    process.env.PAYMENT_BASE_URL ??
    'https://assessment.lumiere.dev/api/v1/payment',
  externalApiTimeoutMs: Number(process.env.EXTERNAL_API_TIMEOUT_MS ?? 5000),
  candidateName: process.env.CANDIDATE_NAME ?? '',
}));

export default appConfig;
