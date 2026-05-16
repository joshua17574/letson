export type PaymentSummaryRow = {
  customerId: string;
  customer: string;
  type?: string;
  sales: number;
  paid: number;
  balance: number;
  packs: number;
};

export type PaymentSummaryResponse = {
  rows: PaymentSummaryRow[];
  totals: {
    sales: number;
    paid: number;
    balance: number;
    packs: number;
  };
};

export type PaymentHistoryItem = {
  _id: string;
  customerId: string;
  customerName: string;
  paymentDate: string;
  amount: number;
  referenceNo?: string;
  remarks?: string;
  receiptImageUrl?: string;
  createdAt?: string;
};