import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CheckoutItemRequestDto {
  @ApiProperty({ example: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  inventory_id!: number;

  @ApiProperty({ example: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty({ example: 2000000, minimum: 0.01, maximum: 99999999.99 })
  @Type(() => Number)
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  subtotal!: number;
}

export class CheckoutRequestDto {
  @ApiProperty({ example: 'Credit Card', maxLength: 30 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  payment_method!: string;

  @ApiPropertyOptional({ example: 10, default: 0, minimum: 0, maximum: 100 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  discount: number = 0;

  @ApiProperty({ type: [CheckoutItemRequestDto], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((item: CheckoutItemRequestDto) => item.inventory_id, {
    message: 'items must not contain duplicate inventory_id values',
  })
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemRequestDto)
  items!: CheckoutItemRequestDto[];
}
