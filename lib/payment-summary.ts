type PaymentPositionInput = {
  sales: number;
  immediateCashSales: number;
  recordedPayments: number;
};

/**
 * Mobile POS sales settle immediately and do not create Payment rows. All
 * other collections are represented by Payment.amount, so these sources can
 * be added without double-counting an allocation.
 */
export function paymentPosition(input: PaymentPositionInput) {
  const sales = Number(input.sales || 0);
  const paid =
    Number(input.immediateCashSales || 0) + Number(input.recordedPayments || 0);

  return {
    sales,
    paid,
    balance: sales - paid,
  };
}
