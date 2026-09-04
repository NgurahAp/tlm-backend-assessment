import { Prisma } from '../generated/prisma/client.js';
import { CheckoutCalculatorService } from './checkout-calculator.service.js';

describe('CheckoutCalculatorService', () => {
  const calculator = new CheckoutCalculatorService();

  it('calculates subtotal, percentage discount, and grand total precisely', () => {
    const result = calculator.calculate(
      [
        { subtotal: new Prisma.Decimal('2000000.00') },
        { subtotal: new Prisma.Decimal('1000000.00') },
      ],
      10,
    );

    expect(result.subtotal.toFixed(2)).toBe('3000000.00');
    expect(result.discount.toFixed(2)).toBe('10.00');
    expect(result.grandTotal.toFixed(2)).toBe('2700000.00');
  });

  it('rounds the discount amount to two decimal places', () => {
    const result = calculator.calculate(
      [{ subtotal: new Prisma.Decimal('100.05') }],
      10,
    );

    expect(result.grandTotal.toFixed(2)).toBe('90.04');
  });

  it('rejects a total that cannot fit NUMERIC(10,2)', () => {
    expect(() =>
      calculator.calculate(
        [
          { subtotal: new Prisma.Decimal('99999999.99') },
          { subtotal: new Prisma.Decimal('0.01') },
        ],
        0,
      ),
    ).toThrow('Order subtotal exceeds the supported amount');
  });
});
