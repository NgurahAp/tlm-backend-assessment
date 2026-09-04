import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
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
  @ApiCreatedResponse({
    description: 'Checkout order created and payment verified as PAID.',
    type: CheckoutResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Checkout payload is invalid.',
    type: ApiErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Inventory item was not found.',
    type: ApiErrorResponseDto,
  })
  @ApiUnprocessableEntityResponse({
    description: 'One of the requested inventory items is out of stock.',
    type: ApiErrorResponseDto,
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
