import type { ConfigService } from '@nestjs/config';
import { HealthService } from './health.service.js';

describe('HealthService', () => {
  it('returns application health without accessing a database', () => {
    const config = {
      getOrThrow: (key: string) => {
        if (key === 'app.serviceName') return 'tlm-backend-assessment';
        throw new Error(`Unexpected configuration key: ${key}`);
      },
    } as ConfigService;
    const service = new HealthService(config);

    const result = service.getHealth();

    expect(result).toMatchObject({
      status: 'ok',
      service: 'tlm-backend-assessment',
    });
    expect(result.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
  });
});
