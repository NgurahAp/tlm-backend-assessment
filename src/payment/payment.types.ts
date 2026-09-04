export const PAYMENT_FETCH = Symbol('PAYMENT_FETCH');

export type PaymentFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface PaymentInquiryPayload {
  order_id: string;
  amount: number;
}

export interface PaymentItemPayload {
  product_name: string;
  quantity: number;
  subtotal: number;
}

export interface PaymentPayPayload {
  transaction_id: string;
  items: PaymentItemPayload[];
  discount: number;
  amount: number;
}

export interface PaymentInquiryResult {
  transactionId: string;
  amount: string;
}

export interface PaymentStatusResult extends PaymentInquiryResult {
  status: string;
}

export interface ProcessedPayment {
  transactionId: string;
  status: 'PAID';
  amount: string;
}
