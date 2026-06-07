import { cleanString } from "@/lib/crud-utils";

type MongoDateRange = {
  $gte?: Date;
  $lte?: Date;
};

type DateParts = {
  year: number;
  monthIndex: number;
  day: number;
};

function parseDateOnly(value: unknown): DateParts | null {
  const cleaned = cleanString(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(cleaned);

  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return {
    year,
    monthIndex: month - 1,
    day,
  };
}

function startOfUtcDay(parts: DateParts) {
  return new Date(Date.UTC(parts.year, parts.monthIndex, parts.day, 0, 0, 0, 0));
}

function endOfUtcDay(parts: DateParts) {
  return new Date(
    Date.UTC(parts.year, parts.monthIndex, parts.day, 23, 59, 59, 999)
  );
}

export function getUtcDateRange(dateFrom: unknown, dateTo: unknown) {
  const fromParts = parseDateOnly(dateFrom);
  const toParts = parseDateOnly(dateTo);

  if (!fromParts && !toParts) {
    return {};
  }

  if (fromParts && toParts) {
    const fromStart = startOfUtcDay(fromParts);
    const toEnd = endOfUtcDay(toParts);

    if (fromStart.getTime() <= toEnd.getTime()) {
      return {
        $gte: fromStart,
        $lte: toEnd,
      };
    }

    return {
      $gte: startOfUtcDay(toParts),
      $lte: endOfUtcDay(fromParts),
    };
  }

  if (fromParts) {
    return {
      $gte: startOfUtcDay(fromParts),
    };
  }

  return {
    $lte: endOfUtcDay(toParts as DateParts),
  };
}

export function buildDateRangeFilter(
  field: string,
  dateFrom: unknown,
  dateTo: unknown
) {
  const range = getUtcDateRange(dateFrom, dateTo);

  if (Object.keys(range).length === 0) {
    return {};
  }

  return {
    [field]: range,
  };
}

export function setDateRangeFilter<T extends Record<string, unknown>>(
  filter: T,
  field: string,
  dateFrom: unknown,
  dateTo: unknown
) {
  const range = getUtcDateRange(dateFrom, dateTo) as MongoDateRange;

  if (Object.keys(range).length > 0) {
    (filter as Record<string, unknown>)[field] = range;
  }

  return filter;
}
