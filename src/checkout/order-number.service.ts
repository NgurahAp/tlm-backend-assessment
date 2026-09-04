import { ConflictException, Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';

@Injectable()
export class OrderNumberService {
  async next(
    transaction: Prisma.TransactionClient,
    date: Date,
  ): Promise<string> {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const prefix = `ORD-${year}${month}-`;

    await transaction.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtext(${`lumiere:${prefix}`}))
    `;

    const latest = await transaction.order.findFirst({
      where: { orderNumber: { startsWith: prefix } },
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    });
    const lastSequence = latest
      ? Number(latest.orderNumber.slice(prefix.length))
      : 0;

    if (
      !Number.isInteger(lastSequence) ||
      lastSequence < 0 ||
      lastSequence >= 999
    ) {
      throw new ConflictException({
        code: 'ORDER_NUMBER_CONFLICT',
        message: 'No order number is available for the current month',
      });
    }

    return `${prefix}${String(lastSequence + 1).padStart(3, '0')}`;
  }
}
