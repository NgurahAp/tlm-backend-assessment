import { ApiProperty } from '@nestjs/swagger';

export class OrderItemDataDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 1 })
  order_id!: number;

  @ApiProperty({ example: 'Huawei Smart Watch' })
  product_name!: string;

  @ApiProperty({ example: 1 })
  quantity!: number;

  @ApiProperty({
    example: '2000000.00',
    description: 'Decimal value represented as a string.',
  })
  subtotal!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-07-01T03:00:00.000Z',
  })
  created_at!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-07-01T03:00:00.000Z',
  })
  updated_at!: string;
}

export class OrderItemsResponseDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ type: [OrderItemDataDto] })
  data!: OrderItemDataDto[];

  @ApiProperty({ example: '8be2d021-e56a-4b7a-a9e3-edbfdf97fc4a' })
  requestId!: string;
}
