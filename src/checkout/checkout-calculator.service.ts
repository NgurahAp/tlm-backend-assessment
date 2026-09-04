import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';

const MAX_DATABASE_AMOUNT = new Prisma.Decimal('99999999.99');

export interface CheckoutAmountInput {
  subtotal: Prisma.Decimal;
}

export interface CheckoutTotals {
  subtotal: Prisma.Decimal;
  discount: Prisma.Decimal;
  grandTotal: Prisma.Decimal;
}

@Injectable()
export class CheckoutCalculatorService {
  calculate(
    items: CheckoutAmountInput[],
    discountValue: number,
  ): CheckoutTotals {
    const subtotal = items.reduce(
      (total, item) => total.plus(item.subtotal),
      new Prisma.Decimal(0),
    );
    const discount = new Prisma.Decimal(discountValue).toDecimalPlaces(2);
    const discountAmount = subtotal
      .times(discount)
      .dividedBy(100)
      .toDecimalPlaces(2);
    const grandTotal = subtotal.minus(discountAmount).toDecimalPlaces(2);

    if (subtotal.greaterThan(MAX_DATABASE_AMOUNT)) {
      throw new BadRequestException({
        code: 'ORDER_AMOUNT_OUT_OF_RANGE',
        message: 'Order subtotal exceeds the supported amount',
      });
    }

    return {
      subtotal: subtotal.toDecimalPlaces(2),
      discount,
      grandTotal,
    };
  }
}
