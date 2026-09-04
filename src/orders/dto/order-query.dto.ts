import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ListOrdersQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1, example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100, example: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({
    maxLength: 20,
    example: 'PAID',
    description: 'Exact order status to filter by.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  status?: string;
}

export class OrderIdParamDto {
  @ApiProperty({ type: Number, minimum: 1, example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id!: number;
}
