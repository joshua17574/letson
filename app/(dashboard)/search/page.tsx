import { GlobalSearchPageClient } from "@/components/search/GlobalSearchPageClient";

type SearchType = "ALL" | "CUSTOMERS" | "SALES" | "PAYMENTS" | "DELIVERIES";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function toSearchType(value: string): SearchType {
  const normalized = value.toUpperCase();

  if (
    normalized === "CUSTOMERS" ||
    normalized === "SALES" ||
    normalized === "PAYMENTS" ||
    normalized === "DELIVERIES"
  ) {
    return normalized;
  }

  return "ALL";
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string | string[];
    type?: string | string[];
    dateFrom?: string | string[];
    dateTo?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const initialQuery = firstParam(params.q);
  const initialType = toSearchType(firstParam(params.type));
  const initialDateFrom = firstParam(params.dateFrom);
  const initialDateTo = firstParam(params.dateTo);

  return (
    <GlobalSearchPageClient
      key={`${initialQuery}-${initialType}-${initialDateFrom}-${initialDateTo}`}
      initialQuery={initialQuery}
      initialType={initialType}
      initialDateFrom={initialDateFrom}
      initialDateTo={initialDateTo}
    />
  );
}
