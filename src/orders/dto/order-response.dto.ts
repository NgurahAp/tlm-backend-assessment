import { ApiProperty } from '@nestjs/swagger';
import { OrderItemDataDto } from './order-item-response.dto.js';

export class OrderDataDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'ORD-202601-001' })
  order_number!: string;

  @ApiProperty({ example: 'Credit Card' })
  payment_method!: string;

  @ApiProperty({ example: 'Pending' })
  status!: string;

  @ApiProperty({
    example: '2000000.00',
    description: 'Decimal value represented as a string.',
  })
  subtotal!: string;

  @ApiProperty({
    example: '10.00',
    description: 'Percentage represented as a decimal string.',
  })
  discount!: string;

  @ApiProperty({
    example: '1800000.00',
    description: 'Decimal value represented as a string.',
  })
  grand_total!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-07-01T03:00:00.000Z',
  })
  order_date!: string;

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

export class OrderPaginationMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 1 })
  total!: number;

  @ApiProperty({ example: 1 })
  totalPages!: number;
}

export class ListOrdersResponseDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ type: [OrderDataDto] })
  data!: OrderDataDto[];

  @ApiProperty({ type: OrderPaginationMetaDto })
  meta!: OrderPaginationMetaDto;

  @ApiProperty({ example: '8be2d021-e56a-4b7a-a9e3-edbfdf97fc4a' })
  requestId!: string;
}

export class OrderDetailDataDto extends OrderDataDto {
  @ApiProperty({ type: [OrderItemDataDto] })
  items!: OrderItemDataDto[];

  @ApiProperty({
    required: false,
    nullable: true,
    example: {
      transaction_id: 'TRX_123456789',
      status: 'PAID',
      amount: '1800000.00',
    },
  })
  payment?: {
    transaction_id: string | null;
    status: string;
    amount: string;
  } | null;
}

export class OrderDetailResponseDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ type: OrderDetailDataDto })
  data!: OrderDetailDataDto;

  @ApiProperty({ example: '8be2d021-e56a-4b7a-a9e3-edbfdf97fc4a' })
  requestId!: string;
}
