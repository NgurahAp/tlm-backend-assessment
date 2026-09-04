import { NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { OrdersService } from './orders.service.js';

const timestamp = new Date('2026-07-01T03:00:00.000Z');

function createOrder() {
  return {
    id: 1,
    orderNumber: 'ORD-202601-001',
    paymentMethod: 'Credit Card',
    status: 'Pending',
    subtotal: new Prisma.Decimal('2000000.00'),
    discount: new Prisma.Decimal('10.00'),
    grandTotal: new Prisma.Decimal('1800000.00'),
    orderDate: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function createOrderItem() {
  return {
    id: 1,
    orderId: 1,
    productName: 'Huawei Smart Watch',
    quantity: 1,
    subtotal: new Prisma.Decimal('2000000.00'),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

describe('OrdersService', () => {
  const orderDelegate = {
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
  };
  const prisma = {
    order: orderDelegate,
    $transaction: vi.fn(async (operations: Promise<unknown>[]) =>
      Promise.all(operations),
    ),
  };
  const service = new OrdersService(prisma as unknown as PrismaService);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns mapped orders and pagination metadata', async () => {
    orderDelegate.count.mockResolvedValue(1);
    orderDelegate.findMany.mockResolvedValue([createOrder()]);

    const result = await service.findAll({
      page: 2,
      limit: 10,
      status: 'Pending',
    });

    expect(orderDelegate.findMany).toHaveBeenCalledWith({
      where: { status: 'Pending' },
      orderBy: [{ orderDate: 'desc' }, { id: 'desc' }],
      skip: 10,
      take: 10,
    });
    expect(result).toEqual({
      data: [
        {
          id: 1,
          order_number: 'ORD-202601-001',
          payment_method: 'Credit Card',
          status: 'Pending',
          subtotal: '2000000.00',
          discount: '10.00',
          grand_total: '1800000.00',
          order_date: timestamp.toISOString(),
          created_at: timestamp.toISOString(),
          updated_at: timestamp.toISOString(),
        },
      ],
      meta: {
        page: 2,
        limit: 10,
        total: 1,
        totalPages: 1,
      },
    });
  });

  it('returns zero total pages for an empty result', async () => {
    orderDelegate.count.mockResolvedValue(0);
    orderDelegate.findMany.mockResolvedValue([]);

    await expect(service.findAll({ page: 1, limit: 20 })).resolves.toEqual({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  });

  it('returns an order with mapped items', async () => {
    orderDelegate.findUnique.mockResolvedValue({
      ...createOrder(),
      items: [createOrderItem()],
    });

    const result = await service.findOne(1);

    expect(result.items).toEqual([
      {
        id: 1,
        order_id: 1,
        product_name: 'Huawei Smart Watch',
        quantity: 1,
        subtotal: '2000000.00',
        created_at: timestamp.toISOString(),
        updated_at: timestamp.toISOString(),
      },
    ]);
  });

  it('returns an empty item list for an existing order without items', async () => {
    orderDelegate.findUnique.mockResolvedValue({ items: [] });

    await expect(service.findItems(1)).resolves.toEqual([]);
  });

  it('throws ORDER_NOT_FOUND when an order does not exist', async () => {
    orderDelegate.findUnique.mockResolvedValue(null);

    const error = await service.findOne(999).catch((caught) => caught);

    expect(error).toBeInstanceOf(NotFoundException);
    expect(error.getResponse()).toEqual({
      code: 'ORDER_NOT_FOUND',
      message: 'Order with ID 999 was not found',
    });
  });
});
