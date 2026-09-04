import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  type PrismaClient as PrismaClientType,
} from '../src/generated/prisma/client.js';

describe('Order database integration', () => {
  const orderPrefix = `INTEGRATION-${process.pid}-`;
  let prisma: PrismaClientType;

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_URL;
    if (connectionString === undefined || connectionString.length === 0) {
      throw new Error('DATABASE_URL is required for integration tests');
    }

    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    });
    await prisma.$connect();
  });

  afterEach(async () => {
    await prisma.order.deleteMany({
      where: { orderNumber: { startsWith: orderPrefix } },
    });
  });

  afterAll(async () => {
    if (prisma !== undefined) await prisma.$disconnect();
  });

  it('stores an order and all items atomically', async () => {
    const orderNumber = `${orderPrefix}ATOMIC`;

    const order = await prisma.$transaction(async (transaction) => {
      return transaction.order.create({
        data: {
          orderNumber,
          paymentMethod: 'Credit Card',
          status: 'Pending',
          subtotal: '3000000.00',
          discount: '10.00',
          grandTotal: '2700000.00',
          orderDate: new Date('2026-07-01T03:00:00.000Z'),
          items: {
            create: [
              {
                productName: 'Huawei Smart Watch',
                quantity: 1,
                subtotal: '2000000.00',
              },
              {
                productName: 'Huawei MatePad SE',
                quantity: 1,
                subtotal: '1000000.00',
              },
            ],
          },
        },
        include: { items: { orderBy: { id: 'asc' } } },
      });
    });

    expect(order.items).toHaveLength(2);
    expect(order.items.map((item) => item.productName)).toEqual([
      'Huawei Smart Watch',
      'Huawei MatePad SE',
    ]);
  });

  it('rolls back the order when an item violates a constraint', async () => {
    const orderNumber = `${orderPrefix}ROLLBACK`;

    await expect(
      prisma.$transaction(async (transaction) => {
        const order = await transaction.order.create({
          data: {
            orderNumber,
            paymentMethod: 'Credit Card',
            status: 'Pending',
            subtotal: '100.00',
            discount: '0.00',
            grandTotal: '100.00',
            orderDate: new Date('2026-07-01T03:00:00.000Z'),
          },
        });

        await transaction.orderItem.create({
          data: {
            orderId: order.id,
            productName: 'Invalid item',
            quantity: 0,
            subtotal: '100.00',
          },
        });
      }),
    ).rejects.toThrow();

    await expect(
      prisma.order.findUnique({ where: { orderNumber } }),
    ).resolves.toBeNull();
  });

  it('enforces the unique order number constraint', async () => {
    const orderNumber = `${orderPrefix}UNIQUE`;
    const data = {
      orderNumber,
      paymentMethod: 'Credit Card',
      status: 'Pending',
      subtotal: '100.00',
      discount: '0.00',
      grandTotal: '100.00',
      orderDate: new Date('2026-07-01T03:00:00.000Z'),
    };

    await prisma.order.create({ data });

    await expect(prisma.order.create({ data })).rejects.toThrow();
    await expect(prisma.order.count({ where: { orderNumber } })).resolves.toBe(
      1,
    );
  });

  it('rejects an item whose order does not exist', async () => {
    await expect(
      prisma.orderItem.create({
        data: {
          orderId: 2147483647,
          productName: 'Missing order item',
          quantity: 1,
          subtotal: '100.00',
        },
      }),
    ).rejects.toThrow();
  });

  it('enforces the discount range constraint', async () => {
    await expect(
      prisma.order.create({
        data: {
          orderNumber: `${orderPrefix}DISCOUNT`,
          paymentMethod: 'Credit Card',
          status: 'Pending',
          subtotal: '100.00',
          discount: '101.00',
          grandTotal: '0.00',
          orderDate: new Date('2026-07-01T03:00:00.000Z'),
        },
      }),
    ).rejects.toThrow();
  });

  it('deletes related items through ON DELETE CASCADE', async () => {
    const order = await prisma.order.create({
      data: {
        orderNumber: `${orderPrefix}CASCADE`,
        paymentMethod: 'Credit Card',
        status: 'Pending',
        subtotal: '100.00',
        discount: '0.00',
        grandTotal: '100.00',
        orderDate: new Date('2026-07-01T03:00:00.000Z'),
        items: {
          create: {
            productName: 'Cascade item',
            quantity: 1,
            subtotal: '100.00',
          },
        },
      },
      include: { items: true },
    });
    const itemId = order.items[0].id;

    await prisma.order.delete({ where: { id: order.id } });

    await expect(
      prisma.orderItem.findUnique({ where: { id: itemId } }),
    ).resolves.toBeNull();
  });

  it('stores one payment per order and deletes it with the order', async () => {
    const order = await prisma.order.create({
      data: {
        orderNumber: `${orderPrefix}PAYMENT-CASCADE`,
        paymentMethod: 'Credit Card',
        status: 'PAID',
        subtotal: '100.00',
        discount: '10.00',
        grandTotal: '90.00',
        orderDate: new Date('2026-07-01T03:00:00.000Z'),
      },
    });
    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        transactionId: `${orderPrefix}TRX`,
        status: 'PAID',
        amount: '90.00',
      },
    });

    await expect(
      prisma.payment.create({
        data: {
          orderId: order.id,
          transactionId: `${orderPrefix}TRX-SECOND`,
          status: 'PAID',
          amount: '90.00',
        },
      }),
    ).rejects.toThrow();

    await prisma.order.delete({ where: { id: order.id } });
    await expect(
      prisma.payment.findUnique({ where: { id: payment.id } }),
    ).resolves.toBeNull();
  });
});
