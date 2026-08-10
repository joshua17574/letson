export type OutletPaymentCustomer = {
  id: string;
};

export type OutletPaymentCustomerInput = {
  outletId: string;
  name: string;
  type: "DELIVERY";
  createdBy: string;
};

export type OutletPaymentCustomerStore = {
  findByOutletId(outletId: string): Promise<OutletPaymentCustomer | null>;
  upsertForOutlet(
    input: OutletPaymentCustomerInput,
  ): Promise<OutletPaymentCustomer>;
};

type OutletIdentity = {
  id: string;
  name: string;
};

type DatedOutletIdentity = {
  id: string;
  createdAt: Date;
};

type MobileSaleIdentity = {
  remarks?: string | null;
  source?: string | null;
  saleDate: Date;
};

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mobileOutletTagFilter(outletId: string) {
  const escapedOutletId = escapeRegex(outletId.trim());
  return {
    receiptNumber: { $regex: /^MOB-/ },
    remarks: {
      $regex: new RegExp(`OUTLET:${escapedOutletId}(?:\\s|$)`, "i"),
    },
  };
}

/** Matches every non-voided mobile sale tagged to one outlet. */
export function mobileOutletSalesFilter(outletId: string) {
  return {
    ...mobileOutletTagFilter(outletId),
    isVoided: { $ne: true },
  };
}

/** Matches tagged mobile sales that still lack a payment customer. */
export function mobileOutletSalesWithoutPaymentCustomerFilter(
  outletId: string,
) {
  return {
    ...mobileOutletTagFilter(outletId),
    $or: [{ customerId: { $exists: false } }, { customerId: null }],
  };
}

/**
 * Resolves a historical mobile sale to an outlet without guessing across
 * multiple candidates. Tagged sales are exact. An old untagged MOBILE_POS
 * sale is safe only when exactly one outlet existed on its sale date.
 */
export function resolveMobileSaleOutletId(
  sale: MobileSaleIdentity,
  outlets: DatedOutletIdentity[],
) {
  const taggedId = /OUTLET:([a-f0-9]{24})(?:\s|$)/i.exec(
    String(sale.remarks || ""),
  )?.[1];

  if (taggedId) {
    return (
      outlets.find(
        (candidate) => candidate.id.toLowerCase() === taggedId.toLowerCase(),
      )?.id || null
    );
  }

  if (String(sale.source || "").toUpperCase() !== "MOBILE_POS") {
    return null;
  }

  const saleTime = sale.saleDate.getTime();
  const eligible = outlets.filter(
    (candidate) => candidate.createdAt.getTime() <= saleTime,
  );
  return eligible.length === 1 ? eligible[0].id : null;
}

/** Returns the Customer row used by the Payments module for an outlet. */
export async function ensureOutletPaymentCustomer(
  store: OutletPaymentCustomerStore,
  input: { outlet: OutletIdentity; createdBy: string },
) {
  const outletId = input.outlet.id.trim();
  const name = input.outlet.name.trim().toUpperCase();
  const createdBy = input.createdBy.trim();

  if (!outletId || !name || !createdBy) {
    throw new Error(
      "A valid outlet and cashier are required for payment tracking.",
    );
  }

  const existing = await store.findByOutletId(outletId);
  if (existing) return existing;

  return store.upsertForOutlet({
    outletId,
    name,
    type: "DELIVERY",
    createdBy,
  });
}
