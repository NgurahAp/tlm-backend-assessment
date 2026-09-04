import { Injectable, NotFoundException } from '@nestjs/common';
import type { Order, OrderItem } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { OrderItemDataDto } from './dto/order-item-response.dto.js';
import type { ListOrdersQueryDto } from './dto/order-query.dto.js';
import type {
  OrderDataDto,
  OrderDetailDataDto,
  OrderPaginationMetaDto,
} from './dto/order-response.dto.js';

interface ListOrdersResult {
  data: OrderDataDto[];
  meta: OrderPaginationMetaDto;
}

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListOrdersQueryDto): Promise<ListOrdersResult> {
    const { page, limit, status } = query;
    const where = status === undefined ? undefined : { status };
    const [total, orders] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: [{ orderDate: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: orders.map((order) => this.toOrderData(order)),
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number): Promise<OrderDetailDataDto> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { id: 'asc' },
        },
        payment: true,
      },
    });

    if (order === null) this.throwOrderNotFound(id);

    return {
      ...this.toOrderData(order),
      items: order.items.map((item) => this.toOrderItemData(item)),
      payment: order.payment
        ? {
            transaction_id: order.payment.transactionId,
            status: order.payment.status,
            amount: order.payment.amount.toFixed(2),
          }
        : null,
    };
  }

  async findItems(id: number): Promise<OrderItemDataDto[]> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: {
        items: {
          orderBy: { id: 'asc' },
        },
      },
    });

    if (order === null) this.throwOrderNotFound(id);

    return order.items.map((item) => this.toOrderItemData(item));
  }

  private toOrderData(order: Order): OrderDataDto {
    return {
      id: order.id,
      order_number: order.orderNumber,
      payment_method: order.paymentMethod,
      status: order.status,
      subtotal: order.subtotal.toFixed(2),
      discount: order.discount.toFixed(2),
      grand_total: order.grandTotal.toFixed(2),
      order_date: order.orderDate.toISOString(),
      created_at: order.createdAt.toISOString(),
      updated_at: order.updatedAt.toISOString(),
    };
  }

  private toOrderItemData(item: OrderItem): OrderItemDataDto {
    return {
      id: item.id,
      order_id: item.orderId,
      product_name: item.productName,
      quantity: item.quantity,
      subtotal: item.subtotal.toFixed(2),
      created_at: item.createdAt.toISOString(),
      updated_at: item.updatedAt.toISOString(),
    };
  }

  private throwOrderNotFound(id: number): never {
    throw new NotFoundException({
      code: 'ORDER_NOT_FOUND',
      message: `Order with ID ${id} was not found`,
    });
  }
}
