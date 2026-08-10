import CustomerModel from "@/models/Customer";
import {
  ensureOutletPaymentCustomer,
  type OutletPaymentCustomerStore,
} from "@/lib/mobile-outlet-payments";

type MongoDuplicateError = Error & { code?: number };

function isDuplicateKeyError(error: unknown): error is MongoDuplicateError {
  return (
    error instanceof Error &&
    "code" in error &&
    Number((error as MongoDuplicateError).code) === 11000
  );
}

type StoredCustomer = {
  _id: { toString: () => string };
  isActive?: boolean;
};

function activeCustomer(customer: StoredCustomer | null) {
  if (customer?.isActive === false) {
    throw new Error("The outlet payment account is inactive.");
  }
  return customer ? { id: customer._id.toString() } : null;
}

/** Resolves or creates the immutable Customer account for one outlet. */
export async function ensureMongooseOutletPaymentCustomer(input: {
  outlet: { id: string; name: string };
  createdBy: string;
}) {
  const store: OutletPaymentCustomerStore = {
    findByOutletId: async (outletId) => {
      const customer = await CustomerModel.findOne({ outletId })
        .select("_id isActive")
        .lean<StoredCustomer>();
      return activeCustomer(customer);
    },
    upsertForOutlet: async (customerInput) => {
      try {
        const customer = await CustomerModel.findOneAndUpdate(
          { outletId: customerInput.outletId },
          {
            $setOnInsert: {
              name: customerInput.name,
              type: customerInput.type,
              isActive: true,
              createdBy: customerInput.createdBy,
            },
          },
          { new: true, upsert: true, setDefaultsOnInsert: true },
        )
          .select("_id isActive")
          .lean<StoredCustomer>();

        const account = activeCustomer(customer);
        if (!account) {
          throw new Error("Unable to create the outlet payment account.");
        }
        return account;
      } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;

        const winner = await CustomerModel.findOne({
          outletId: customerInput.outletId,
        })
          .select("_id isActive")
          .lean<StoredCustomer>();
        const account = activeCustomer(winner);
        if (!account) throw error;
        return account;
      }
    },
  };

  return ensureOutletPaymentCustomer(store, input);
}
