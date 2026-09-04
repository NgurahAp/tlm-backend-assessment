import type { PinoLogger } from 'nestjs-pino';
import type { Payment } from '../generated/prisma/client.js';
import { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { PaymentClient } from './payment.client.js';
import { PaymentService } from './payment.service.js';

describe('PaymentService', () => {
  it('returns an existing PAID record without calling the external API again', async () => {
    const existingPayment = {
      id: 1,
      orderId: 10,
      transactionId: 'TRX_EXISTING',
      status: 'PAID',
      amount: new Prisma.Decimal('900.00'),
      failureCode: null,
      failureMessage: null,
      externalResponse: null,
      inquiryAt: new Date(),
      paidAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies Payment;
    const prisma = {
      payment: {
        findUnique: vi.fn().mockResolvedValue(existingPayment),
      },
    } as unknown as PrismaService;
    const client = {
      inquiry: vi.fn(),
      pay: vi.fn(),
      status: vi.fn(),
    } as unknown as PaymentClient;
    const logger = {
      info: vi.fn(),
      error: vi.fn(),
    } as unknown as PinoLogger;
    const service = new PaymentService(prisma, client, logger);

    await expect(
      service.process(
        {
          id: 10,
          orderNumber: 'ORD-202609-001',
          paymentMethod: 'Credit Card',
          status: 'PAID',
          subtotal: new Prisma.Decimal('1000.00'),
          discount: new Prisma.Decimal('10.00'),
          grandTotal: new Prisma.Decimal('900.00'),
          orderDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          items: [],
        },
        'request-1',
      ),
    ).resolves.toEqual({
      transactionId: 'TRX_EXISTING',
      status: 'PAID',
      amount: '900.00',
    });
    expect(client.inquiry).not.toHaveBeenCalled();
    expect(client.pay).not.toHaveBeenCalled();
    expect(client.status).not.toHaveBeenCalled();
  });
});
