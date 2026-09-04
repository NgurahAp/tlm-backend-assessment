import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrorResponseDto } from '../common/dto/api-error-response.dto.js';
import { HealthResponseDto } from './dto/health-response.dto.js';
import { HealthService } from './health.service.js';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({
    summary: 'Check application health',
    description:
      'Checks the NestJS application process. PostgreSQL connectivity is verified during application startup.',
  })
  @ApiOkResponse({
    description: 'The application process is healthy.',
    type: HealthResponseDto,
    headers: {
      'X-Request-Id': {
        description: 'Correlation ID for this request.',
        schema: { type: 'string' },
      },
    },
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected application error.',
    type: ApiErrorResponseDto,
  })
  getHealth(@Req() request: Request): HealthResponseDto {
    return {
      success: true,
      data: this.healthService.getHealth(),
      requestId: String(request.id),
    };
  }
}
