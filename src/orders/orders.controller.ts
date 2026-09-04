import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrorResponseDto } from '../common/dto/api-error-response.dto.js';
import { OrderItemsResponseDto } from './dto/order-item-response.dto.js';
import { ListOrdersQueryDto, OrderIdParamDto } from './dto/order-query.dto.js';
import {
  ListOrdersResponseDto,
  OrderDetailResponseDto,
} from './dto/order-response.dto.js';
import { OrdersService } from './orders.service.js';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({
    summary: 'List orders with pagination and optional status filter',
  })
  @ApiOkResponse({
    description: 'Paginated orders.',
    type: ListOrdersResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid pagination or filter.',
    type: ApiErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected application error.',
    type: ApiErrorResponseDto,
  })
  async findAll(
    @Query() query: ListOrdersQueryDto,
    @Req() request: Request,
  ): Promise<ListOrdersResponseDto> {
    const result = await this.ordersService.findAll(query);

    return {
      success: true,
      ...result,
      requestId: String(request.id),
    };
  }

  @Get(':id/items')
  @ApiOperation({ summary: 'List items belonging to a specific order' })
  @ApiParam({
    name: 'id',
    description: 'Order ID.',
    schema: { type: 'integer', minimum: 1, example: 1 },
  })
  @ApiOkResponse({
    description: 'Order items ordered by ID.',
    type: OrderItemsResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Order ID is not a positive integer.',
    type: ApiErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Order was not found.',
    type: ApiErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected application error.',
    type: ApiErrorResponseDto,
  })
  async findItems(
    @Param() params: OrderIdParamDto,
    @Req() request: Request,
  ): Promise<OrderItemsResponseDto> {
    return {
      success: true,
      data: await this.ordersService.findItems(params.id),
      requestId: String(request.id),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an order and its items' })
  @ApiParam({
    name: 'id',
    description: 'Order ID.',
    schema: { type: 'integer', minimum: 1, example: 1 },
  })
  @ApiOkResponse({ description: 'Order detail.', type: OrderDetailResponseDto })
  @ApiBadRequestResponse({
    description: 'Order ID is not a positive integer.',
    type: ApiErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Order was not found.',
    type: ApiErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected application error.',
    type: ApiErrorResponseDto,
  })
  async findOne(
    @Param() params: OrderIdParamDto,
    @Req() request: Request,
  ): Promise<OrderDetailResponseDto> {
    return {
      success: true,
      data: await this.ordersService.findOne(params.id),
      requestId: String(request.id),
    };
  }
}
