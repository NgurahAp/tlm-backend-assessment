export interface InventoryItem {
  inventoryId: number;
  productName: string;
  stock: number;
}

export type InventoryFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export const INVENTORY_FETCH = Symbol('INVENTORY_FETCH');
