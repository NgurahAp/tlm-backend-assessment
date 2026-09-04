import { ApiProperty } from '@nestjs/swagger';
import { OrderDetailDataDto } from '../../orders/dto/order-response.dto.js';

export class CheckoutDataDto extends OrderDetailDataDto {
  @ApiProperty({ example: 'TRX_123456789' })
  transaction_id!: string;
}

export class CheckoutResponseDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ type: CheckoutDataDto })
  data!: CheckoutDataDto;

  @ApiProperty({ example: '8be2d021-e56a-4b7a-a9e3-edbfdf97fc4a' })
  requestId!: string;
}
