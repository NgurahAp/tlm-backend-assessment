import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module.js';
import { PaymentModule } from '../payment/payment.module.js';
import { CheckoutCalculatorService } from './checkout-calculator.service.js';
import { CheckoutController } from './checkout.controller.js';
import { CheckoutService } from './checkout.service.js';
import { OrderNumberService } from './order-number.service.js';

@Module({
  imports: [InventoryModule, PaymentModule],
  controllers: [CheckoutController],
  providers: [CheckoutService, CheckoutCalculatorService, OrderNumberService],
})
export class CheckoutModule {}
