import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthDataDto } from './dto/health-response.dto.js';

@Injectable()
export class HealthService {
  constructor(private readonly config: ConfigService) {}

  getHealth(): HealthDataDto {
    return {
      status: 'ok',
      service: this.config.getOrThrow<string>('app.serviceName'),
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }
}
