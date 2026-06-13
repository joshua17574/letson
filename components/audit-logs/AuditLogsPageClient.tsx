"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, Loader2, RefreshCcw, ScrollText, Search } from "lucide-react";
import { toast } from "sonner";

import { ModuleHeader } from "@/components/app-shell/ModuleHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type AuditLogRow = {
  _id: string;
  module: string;
  action: string;
  entityType: string;
  entityId: string;
  remarks: string;
  sourceChannel: string;
  oldValue: unknown;
  newValue: unknown;
  userId: string;
  userName: string;
  createdAt?: string;
};

type FilterOptions = {
  modules: string[];
  actions: string[];
  users: { _id: string; name: string }[];
};

type ApiMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const ACTION_BADGE_CLASS: Record<string, string> = {
  CREATE: "bg-emerald-100 text-emerald-700",
  UPDATE: "bg-sky-100 text-sky-700",
  DELETE: "bg-rose-100 text-rose-700",
  VOID: "bg-rose-100 text-rose-700",
  STOCK_IN: "bg-amber-100 text-amber-700",
  STOCK_ADJUSTMENT: "bg-amber-100 text-amber-700",
  CONFIRM: "bg-emerald-100 text-emerald-700",
};

function formatDateTime(value?: string) {
  if (!value) return "-";

  return new Date(value).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatJsonValue(value: unknown) {
  if (value === null || value === undefined) return "";

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function AuditLogsPageClient() {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    modules: [],
    actions: [],
    users: [],
  });
  const [meta, setMeta] = useState<ApiMeta>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(false);

  const [page, setPage] = useState(1);
  const [moduleFilter, setModuleFilter] = useState("ALL");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [userFilter, setUserFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  const [selectedLog, setSelectedLog] = useState<AuditLogRow | null>(null);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "25",
      });

      if (moduleFilter !== "ALL") params.set("module", moduleFilter);
      if (actionFilter !== "ALL") params.set("action", actionFilter);
      if (userFilter !== "ALL") params.set("userId", userFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (appliedSearch) params.set("search", appliedSearch);

      const res = await fetch(`/api/audit-logs?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Unable to load audit logs.");
      }

      setLogs(Array.isArray(json.data) ? json.data : []);
      setFilterOptions(
        json.filters || { modules: [], actions: [], users: [] }
      );
      setMeta(
        json.meta || {
          page,
          limit: 25,
          total: 0,
          totalPages: 1,
        }
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to load audit logs."
      );
    } finally {
      setIsLoading(false);
    }
  }, [page, moduleFilter, actionFilter, userFilter, dateFrom, dateTo, appliedSearch]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  function applySearch() {
    setPage(1);
    setAppliedSearch(search.trim());
  }

  function resetFilters() {
    setPage(1);
    setModuleFilter("ALL");
    setActionFilter("ALL");
    setUserFilter("ALL");
    setDateFrom("");
    setDateTo("");
    setSearch("");
    setAppliedSearch("");
  }

  return (
    <div>
      <ModuleHeader
        eyebrow="System"
        title="Audit Logs"
        description="Every create, update, void, and delete across the system — who did it, when, and what changed."
        actions={
          <Button variant="outline" onClick={() => void loadLogs()} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCcw className="size-4" />
            )}
            Refresh
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
          <div className="space-y-1.5">
            <Label>Module</Label>
            <Select
              value={moduleFilter}
              onValueChange={(value) => {
                setPage(1);
                setModuleFilter(value);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All modules" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All modules</SelectItem>
                {filterOptions.modules.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item.replaceAll("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Action</Label>
            <Select
              value={actionFilter}
              onValueChange={(value) => {
                setPage(1);
                setActionFilter(value);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All actions</SelectItem>
                {filterOptions.actions.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item.replaceAll("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>User</Label>
            <Select
              value={userFilter}
              onValueChange={(value) => {
                setPage(1);
                setUserFilter(value);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All users</SelectItem>
                {filterOptions.users.map((user) => (
                  <SelectItem key={user._id} value={user._id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Date from</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setPage(1);
                setDateFrom(event.target.value);
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Date to</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(event) => {
                setPage(1);
                setDateTo(event.target.value);
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Search</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Remarks, entity..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") applySearch();
                }}
              />
              <Button variant="outline" size="icon" onClick={applySearch}>
                <Search className="size-4" />
              </Button>
            </div>
          </div>

          <div className="sm:col-span-2 lg:col-span-6">
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              Reset filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date / Time</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Remarks</TableHead>
                <TableHead className="w-16 text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-slate-500">
                    <Loader2 className="mx-auto size-5 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-slate-500">
                    <ScrollText className="mx-auto mb-2 size-6" />
                    No audit logs found for the selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log._id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDateTime(log.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{log.userName}</TableCell>
                    <TableCell className="text-sm">
                      {log.module.replaceAll("_", " ")}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          ACTION_BADGE_CLASS[log.action] ||
                          "bg-slate-100 text-slate-700"
                        }
                      >
                        {log.action.replaceAll("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.entityType.replaceAll("_", " ")}
                    </TableCell>
                    <TableCell className="max-w-72 truncate text-sm text-slate-600">
                      {log.remarks || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelectedLog(log)}
                      >
                        <Eye className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
            <p className="text-sm text-slate-500">
              {meta.total.toLocaleString("en-PH")} entries · Page {meta.page} of{" "}
              {meta.totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || isLoading}
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= meta.totalPages || isLoading}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(selectedLog)}
        onOpenChange={(open) => {
          if (!open) setSelectedLog(null);
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedLog
                ? `${selectedLog.module.replaceAll("_", " ")} · ${selectedLog.action.replaceAll("_", " ")}`
                : "Audit log"}
            </DialogTitle>
            <DialogDescription>
              {selectedLog
                ? `${selectedLog.userName} · ${formatDateTime(selectedLog.createdAt)}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {selectedLog ? (
            <div className="space-y-4 text-sm">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <p className="font-semibold text-slate-700">Entity</p>
                  <p className="text-slate-600">
                    {selectedLog.entityType.replaceAll("_", " ")}
                    {selectedLog.entityId ? ` · ${selectedLog.entityId}` : ""}
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-slate-700">Source</p>
                  <p className="text-slate-600">{selectedLog.sourceChannel}</p>
                </div>
              </div>

              {selectedLog.remarks ? (
                <div>
                  <p className="font-semibold text-slate-700">Remarks</p>
                  <p className="text-slate-600">{selectedLog.remarks}</p>
                </div>
              ) : null}

              {selectedLog.oldValue !== null &&
              selectedLog.oldValue !== undefined ? (
                <div>
                  <p className="mb-1 font-semibold text-slate-700">Old value</p>
                  <pre className="max-h-60 overflow-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
                    {formatJsonValue(selectedLog.oldValue)}
                  </pre>
                </div>
              ) : null}

              {selectedLog.newValue !== null &&
              selectedLog.newValue !== undefined ? (
                <div>
                  <p className="mb-1 font-semibold text-slate-700">
                    Submitted data
                  </p>
                  <pre className="max-h-60 overflow-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
                    {formatJsonValue(selectedLog.newValue)}
                  </pre>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
