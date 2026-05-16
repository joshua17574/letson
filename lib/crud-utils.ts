// lib/crud-utils.ts
export function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function cleanNumber(value: unknown, fallback = 0) {
  const number = Number(value);

  if (Number.isNaN(number) || number < 0) {
    return fallback;
  }

  return number;
}

export function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function getPagination(searchParams: URLSearchParams) {
  const page = Math.max(Number(searchParams.get("page") || 1), 1);
  const rawLimit = Number(searchParams.get("limit") || 10);
  const allowedLimits = [10, 25, 50, 100];

  const limit = allowedLimits.includes(rawLimit) ? rawLimit : 10;
  const skip = (page - 1) * limit;

  return {
    page,
    limit,
    skip,
  };
}

type SerializableDoc = Record<string, any> & {
  _id: {
    toString: () => string;
  };
};

export function serializeDocument<T extends SerializableDoc>(doc: T) {
  return {
    ...doc,
    _id: doc._id.toString(),
    createdAt: doc.createdAt
      ? new Date(doc.createdAt).toISOString()
      : undefined,
    updatedAt: doc.updatedAt
      ? new Date(doc.updatedAt).toISOString()
      : undefined,
  };
}

export function serializeDocuments<T extends SerializableDoc[]>(docs: T) {
  return docs.map((doc) => serializeDocument(doc));
}