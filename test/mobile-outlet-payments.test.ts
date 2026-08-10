import assert from "node:assert/strict";
import test from "node:test";

import {
  ensureOutletPaymentCustomer,
  mobileOutletSalesWithoutPaymentCustomerFilter,
  resolveMobileSaleOutletId,
  type OutletPaymentCustomer,
  type OutletPaymentCustomerStore,
} from "../lib/mobile-outlet-payments";
import { paymentPosition } from "../lib/payment-summary";
import { isOutletManagedCustomer } from "../lib/outlet-payment-customer-policy";

const outlet = {
  id: "507f1f77bcf86cd799439011",
  name: "Main Outlet",
};

test("matches missing and null customer links for only one tagged outlet", () => {
  const filter = mobileOutletSalesWithoutPaymentCustomerFilter(outlet.id);

  assert.deepEqual(filter.$or, [
    { customerId: { $exists: false } },
    { customerId: null },
  ]);
  assert.match("MOB-20260808-0001", filter.receiptNumber.$regex);
  assert.match(`MOBILE SALE OUTLET:${outlet.id}`, filter.remarks.$regex);
  assert.match(
    `MOBILE SALE OUTLET:${outlet.id} SHIFT:507f191e810c19729de860ea`,
    filter.remarks.$regex,
  );
  assert.doesNotMatch(
    `MOBILE SALE OUTLET:${outlet.id}A`,
    filter.remarks.$regex,
  );
});

test("maps tagged sales to their exact outlet", () => {
  const otherOutlet = {
    id: "507f1f77bcf86cd799439012",
    createdAt: new Date("2026-08-01T00:00:00Z"),
  };

  assert.equal(
    resolveMobileSaleOutletId(
      {
        remarks: `MOBILE SALE OUTLET:${otherOutlet.id}`,
        source: "BODEGA",
        saleDate: new Date("2026-08-10T00:00:00Z"),
      },
      [
        { id: outlet.id, createdAt: new Date("2026-08-01T00:00:00Z") },
        otherOutlet,
      ],
    ),
    otherOutlet.id,
  );
});

test("maps an untagged legacy mobile sale only when one outlet existed", () => {
  const sale = {
    remarks: "",
    source: "MOBILE_POS",
    saleDate: new Date("2026-08-02T07:33:52Z"),
  };
  const eligibleOutlet = {
    id: outlet.id,
    createdAt: new Date("2026-08-02T07:03:06Z"),
  };

  assert.equal(resolveMobileSaleOutletId(sale, [eligibleOutlet]), outlet.id);
  assert.equal(
    resolveMobileSaleOutletId(sale, [
      eligibleOutlet,
      {
        id: "507f1f77bcf86cd799439012",
        createdAt: new Date("2026-08-01T00:00:00Z"),
      },
    ]),
    null,
  );
  assert.equal(
    resolveMobileSaleOutletId(sale, [
      {
        id: outlet.id,
        createdAt: new Date("2026-08-03T00:00:00Z"),
      },
    ]),
    null,
  );
});

test("reuses an existing payment customer linked to the outlet", async () => {
  const existing: OutletPaymentCustomer = { id: "customer-1" };
  let upserted = false;
  const store: OutletPaymentCustomerStore = {
    findByOutletId: async () => existing,
    upsertForOutlet: async () => {
      upserted = true;
      return { id: "customer-2" };
    },
  };

  const customer = await ensureOutletPaymentCustomer(store, {
    outlet,
    createdBy: "cashier-1",
  });

  assert.equal(customer.id, "customer-1");
  assert.equal(upserted, false);
});

test("creates a dedicated account instead of claiming a same-name customer", async () => {
  let createdName = "";
  const store: OutletPaymentCustomerStore = {
    findByOutletId: async () => null,
    upsertForOutlet: async (input) => {
      createdName = input.name;
      return { id: "customer-new" };
    },
  };

  const customer = await ensureOutletPaymentCustomer(store, {
    outlet,
    createdBy: "cashier-1",
  });

  assert.equal(customer.id, "customer-new");
  assert.equal(createdName, "MAIN OUTLET");
});

test("counts settled sales plus unapplied credit without double-counting", () => {
  assert.deepEqual(
    paymentPosition({
      sales: 300,
      immediateCashSales: 50,
      recordedPayments: 220,
    }),
    {
      sales: 300,
      paid: 270,
      balance: 30,
    },
  );

  assert.deepEqual(
    paymentPosition({
      sales: 250,
      immediateCashSales: 250,
      recordedPayments: 0,
    }),
    {
      sales: 250,
      paid: 250,
      balance: 0,
    },
  );
});

test("protects only customers managed by an outlet", () => {
  assert.equal(
    isOutletManagedCustomer({ outletId: "507f1f77bcf86cd799439011" }),
    true,
  );
  assert.equal(isOutletManagedCustomer({ outletId: null }), false);
  assert.equal(isOutletManagedCustomer({}), false);
});
