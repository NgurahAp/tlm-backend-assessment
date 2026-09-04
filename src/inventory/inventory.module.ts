import { Module } from '@nestjs/common';
import { InventoryClient } from './inventory.client.js';
import { INVENTORY_FETCH, type InventoryFetch } from './inventory.types.js';

@Module({
  providers: [
    InventoryClient,
    {
      provide: INVENTORY_FETCH,
      useFactory: (): InventoryFetch => globalThis.fetch.bind(globalThis),
    },
  ],
  exports: [InventoryClient],
})
export class InventoryModule {}
