import { ApiProperty } from '@nestjs/swagger';

export class ApiErrorDto {
  @ApiProperty({ example: 'NOT_FOUND' })
  code!: string;

  @ApiProperty({ example: 'Cannot GET /unknown' })
  message!: string;

  @ApiProperty({ type: [String], example: [] })
  details!: string[];
}

export class ApiErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ type: ApiErrorDto })
  error!: ApiErrorDto;

  @ApiProperty({ example: '8be2d021-e56a-4b7a-a9e3-edbfdf97fc4a' })
  requestId!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-09-04T04:00:00.000Z',
  })
  timestamp!: string;

  @ApiProperty({ example: '/unknown' })
  path!: string;
}
