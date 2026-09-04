import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiGatewayTimeoutResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { ApiErrorResponseDto } from '../common/dto/api-error-response.dto.js';
import { CheckoutService } from './checkout.service.js';
import { CheckoutRequestDto } from './dto/checkout-request.dto.js';
import { CheckoutResponseDto } from './dto/checkout-response.dto.js';

@ApiTags('Checkout')
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Create an order after validating inventory availability',
    description:
      'Checks inventory, atomically stores the order and its items, then performs payment inquiry, pay, and status verification.',
  })
  @ApiBody({
    type: CheckoutRequestDto,
    examples: {
      availableInventory: {
        summary: 'Inventory IDs 1 and 2 are available',
        value: {
          payment_method: 'Credit Card',
          discount: 10,
          items: [
            { inventory_id: 1, quantity: 1, subtotal: 2000000 },
            { inventory_id: 2, quantity: 1, subtotal: 1000000 },
          ],
        },
      },
      unavailableInventory: {
        summary: 'Inventory ID 3 is out of stock',
        value: {
          payment_method: 'Credit Card',
          discount: 0,
          items: [{ inventory_id: 3, quantity: 1, subtotal: 1000000 }],
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Checkout order created and payment verified as PAID.',
    type: CheckoutResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Checkout payload is invalid.',
    type: ApiErrorResponseDto,
    example: {
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Request validation failed',
        details: ['quantity must not be less than 1'],
      },
      requestId: 'checkout-manual-001',
      timestamp: '2026-09-04T04:00:00.000Z',
      path: '/checkout',
    },
  })
  @ApiNotFoundResponse({
    description: 'Inventory item was not found.',
    type: ApiErrorResponseDto,
  })
  @ApiUnprocessableEntityResponse({
    description: 'One of the requested inventory items is out of stock.',
    type: ApiErrorResponseDto,
    example: {
      success: false,
      error: {
        code: 'INVENTORY_OUT_OF_STOCK',
        message: 'Inventory item 3 does not have enough stock',
        details: [],
      },
      requestId: 'checkout-manual-001',
      timestamp: '2026-09-04T04:00:00.000Z',
      path: '/checkout',
    },
  })
  @ApiBadGatewayResponse({
    description:
      'Inventory or payment service failed or returned an invalid response.',
    type: ApiErrorResponseDto,
  })
  @ApiGatewayTimeoutResponse({
    description: 'Inventory or payment service timed out.',
    type: ApiErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Order number or payment processing conflicts.',
    type: ApiErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Checkout configuration or persistence failed.',
    type: ApiErrorResponseDto,
  })
  async checkout(
    @Body() body: CheckoutRequestDto,
    @Req() request: Request,
  ): Promise<CheckoutResponseDto> {
    return {
      success: true,
      data: await this.checkoutService.checkout(body, String(request.id)),
      requestId: String(request.id),
    };
  }
}
