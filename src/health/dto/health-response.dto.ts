import { ApiProperty } from '@nestjs/swagger';

export class HealthDataDto {
  @ApiProperty({ example: 'ok' })
  status!: 'ok';

  @ApiProperty({ example: 'tlm-backend-assessment' })
  service!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-09-04T04:00:00.000Z',
  })
  timestamp!: string;

  @ApiProperty({ example: 12 })
  uptimeSeconds!: number;
}

export class HealthResponseDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ type: HealthDataDto })
  data!: HealthDataDto;

  @ApiProperty({ example: '8be2d021-e56a-4b7a-a9e3-edbfdf97fc4a' })
  requestId!: string;
}
