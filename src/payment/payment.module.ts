import { Module } from '@nestjs/common';
import { CandidateHeaderService } from './candidate-header.service.js';
import { PaymentClient } from './payment.client.js';
import { PaymentService } from './payment.service.js';
import { PAYMENT_FETCH, type PaymentFetch } from './payment.types.js';

@Module({
  providers: [
    CandidateHeaderService,
    PaymentClient,
    PaymentService,
    {
      provide: PAYMENT_FETCH,
      useFactory: (): PaymentFetch => globalThis.fetch.bind(globalThis),
    },
  ],
  exports: [PaymentService],
})
export class PaymentModule {}
