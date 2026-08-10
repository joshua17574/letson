type CustomerOwnership = {
  outletId?: unknown;
};

export function isOutletManagedCustomer(customer: CustomerOwnership) {
  return customer.outletId !== undefined && customer.outletId !== null;
}
