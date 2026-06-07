"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Loader2, RefreshCcw, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPeso } from "@/lib/utils";

type SearchType = "ALL" | "CUSTOMERS" | "SALES" | "PAYMENTS" | "DELIVERIES";

type SearchFilters = {
  query: string;
  type: SearchType;
  dateFrom: string;
  dateTo: string;
};

type SearchResult = {
  _id: string;
  kind: string;
  title: string;
  subtitle: string;
  date: string;
  amount: number | null;
  href: string;
};

type Props = {
  initialQuery?: string;
  initialType?: SearchType;
  initialDateFrom?: string;
  initialDateTo?: string;
};

const searchTypeOptions: { label: string; value: SearchType }[] = [
  { label: "All records", value: "ALL" },
  { label: "Customers", value: "CUSTOMERS" },
  { label: "Sales", value: "SALES" },
  { label: "Payments", value: "PAYMENTS" },
  { label: "Deliveries", value: "DELIVERIES" },
];

function formatDate(value?: string) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function buildSearchUrl(filters: SearchFilters) {
  const params = new URLSearchParams();

  if (filters.query) params.set("q", filters.query);
  if (filters.type !== "ALL") params.set("type", filters.type);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);

  const query = params.toString();
  return query ? `/search?${query}` : "/search";
}

function buildApiUrl(filters: SearchFilters) {
  const params = new URLSearchParams({
    limit: "10",
  });

  if (filters.query) params.set("q", filters.query);
  if (filters.type !== "ALL") params.set("type", filters.type);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);

  return `/api/search?${params.toString()}`;
}

function formValue(formData: FormData | null, name: string) {
  const value = formData?.get(name);
  return typeof value === "string" ? value : "";
}

function toSearchType(value: string): SearchType {
  return searchTypeOptions.some((option) => option.value === value)
    ? (value as SearchType)
    : "ALL";
}

export function GlobalSearchPageClient({
  initialQuery = "",
  initialType = "ALL",
  initialDateFrom = "",
  initialDateTo = "",
}: Props) {
  const router = useRouter();
  const initialFilters = useMemo<SearchFilters>(
    () => ({
      query: initialQuery.trim(),
      type: initialType,
      dateFrom: initialDateFrom,
      dateTo: initialDateTo,
    }),
    [initialDateFrom, initialDateTo, initialQuery, initialType]
  );

  const [query, setQuery] = useState(initialFilters.query);
  const [type, setType] = useState<SearchType>(initialFilters.type);
  const [dateFrom, setDateFrom] = useState(initialFilters.dateFrom);
  const [dateTo, setDateTo] = useState(initialFilters.dateTo);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const hasActiveFilter = Boolean(
    appliedFilters.query ||
      appliedFilters.type !== "ALL" ||
      appliedFilters.dateFrom ||
      appliedFilters.dateTo
  );
  const hasDraftFilter = Boolean(
    query.trim() || type !== "ALL" || dateFrom || dateTo
  );

  useEffect(() => {
    const controller = new AbortController();

    async function loadResults() {
      if (!hasActiveFilter) {
        setResults([]);
        return;
      }

      setIsLoading(true);

      try {
        const res = await fetch(buildApiUrl(appliedFilters), {
          cache: "no-store",
          signal: controller.signal,
        });
        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.message || "Failed to search records.");
        }

        setResults(json.data || []);
      } catch (error) {
        if (controller.signal.aborted) return;

        toast.error(
          error instanceof Error ? error.message : "Failed to search records."
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadResults();

    return () => controller.abort();
  }, [appliedFilters, hasActiveFilter]);

  function applyFilters(form?: HTMLFormElement) {
    const formData = form ? new FormData(form) : null;
    const nextFilters: SearchFilters = {
      query: (formValue(formData, "q") || query).trim(),
      type: toSearchType(formValue(formData, "type") || type),
      dateFrom: formValue(formData, "dateFrom") || dateFrom,
      dateTo: formValue(formData, "dateTo") || dateTo,
    };

    setQuery(nextFilters.query);
    setType(nextFilters.type);
    setDateFrom(nextFilters.dateFrom);
    setDateTo(nextFilters.dateTo);
    setAppliedFilters(nextFilters);
    router.push(buildSearchUrl(nextFilters), { scroll: false });
  }

  function resetFilters() {
    const nextFilters: SearchFilters = {
      query: "",
      type: "ALL",
      dateFrom: "",
      dateTo: "",
    };

    setQuery("");
    setType("ALL");
    setDateFrom("");
    setDateTo("");
    setAppliedFilters(nextFilters);
    router.push("/search", { scroll: false });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Search Records
        </h1>
      </div>

      <Card>
        <CardContent className="p-5">
          <form
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr_auto_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              applyFilters(event.currentTarget);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="global-search-query">Search</Label>
              <Input
                id="global-search-query"
                name="q"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Customer, receipt, reference, remarks..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="global-search-type">Record Type</Label>
              <select
                id="global-search-type"
                name="type"
                value={type}
                onChange={(event) => setType(toSearchType(event.target.value))}
                className="h-10 w-full min-w-0 rounded-lg border border-input bg-background/70 px-3 py-1 text-base shadow-[inset_0_1px_0_color-mix(in_oklch,var(--background)_62%,transparent)] transition-[border-color,box-shadow,background-color] duration-200 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:h-8 md:px-2.5 md:text-sm"
              >
                {searchTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="global-search-date-from">Date From</Label>
              <Input
                id="global-search-date-from"
                name="dateFrom"
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onInput={(event) => setDateFrom(event.currentTarget.value)}
                onChange={(event) => setDateFrom(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="global-search-date-to">Date To</Label>
              <Input
                id="global-search-date-to"
                name="dateTo"
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onInput={(event) => setDateTo(event.currentTarget.value)}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </div>

            <div className="flex items-end">
              <Button type="submit" disabled={isLoading || !hasDraftFilter}>
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                Search
              </Button>
            </div>

            <div className="flex items-end">
              <Button
                type="button"
                variant="secondary"
                onClick={resetFilters}
                disabled={isLoading}
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                Reset
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center justify-between gap-3">
            <span>Results</span>
            <Badge variant="secondary">{results.length.toLocaleString()}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader className="bg-slate-900">
                <TableRow>
                  <TableHead className="text-white">Type</TableHead>
                  <TableHead className="text-white">Record</TableHead>
                  <TableHead className="text-white">Details</TableHead>
                  <TableHead className="text-white">Date</TableHead>
                  <TableHead className="text-right text-white">Amount</TableHead>
                  <TableHead className="text-center text-white">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : !hasActiveFilter ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-32 text-center text-muted-foreground"
                    >
                      Enter a search term or date range to find records.
                    </TableCell>
                  </TableRow>
                ) : results.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-32 text-center text-muted-foreground"
                    >
                      No records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  results.map((result) => (
                    <TableRow key={`${result.kind}-${result._id}`}>
                      <TableCell>
                        <Badge variant="outline">{result.kind}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{result.title}</TableCell>
                      <TableCell>{result.subtitle || "-"}</TableCell>
                      <TableCell>{formatDate(result.date)}</TableCell>
                      <TableCell className="text-right">
                        {result.amount === null ? "-" : formatPeso(result.amount)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button size="sm" variant="outline" asChild>
                          <Link href={result.href}>
                            Open
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
