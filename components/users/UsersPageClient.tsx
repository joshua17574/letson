// components/users/UsersPageClient.tsx
"use client";

import { useEffect, useState } from "react";
import {
  Ban,
  Boxes,
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  Coins,
  KeyRound,
  Loader2,
  Mail,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Store,
  UserRoundCog,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { ModuleHeader } from "@/components/app-shell/ModuleHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { cn } from "@/lib/utils";

type RoleOption = {
  _id: string;
  name: string;
  permissionCount: number;
};

type UserRow = {
  _id: string;
  name: string;
  email: string;
  role: string;
  roleId: string;
  roleName: string;
  permissionCount: number;
};

type ApiMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const emptyForm = {
  name: "",
  email: "",
  password: "",
  role: "USER",
  roleId: "",
};

type UserVisual = {
  icon: LucideIcon;
  label: string;
  markClassName: string;
};

const defaultUserVisual: UserVisual = {
  icon: UserRoundCog,
  label: "User account",
  markClassName:
    "border-stone-200 bg-stone-50 text-stone-700 dark:border-stone-800 dark:bg-stone-950/35 dark:text-stone-300",
};

const userVisuals: { keywords: string[]; visual: UserVisual }[] = [
  {
    keywords: ["admin", "administrator", "owner", "super"],
    visual: {
      icon: ShieldCheck,
      label: "Administrator",
      markClassName:
        "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-300",
    },
  },
  {
    keywords: ["cashier", "payment", "sales"],
    visual: {
      icon: Coins,
      label: "Cashier",
      markClassName:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-300",
    },
  },
  {
    keywords: ["inventory", "stock", "product", "warehouse"],
    visual: {
      icon: Boxes,
      label: "Inventory",
      markClassName:
        "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-300",
    },
  },
  {
    keywords: ["manager", "supervisor", "lead"],
    visual: {
      icon: BriefcaseBusiness,
      label: "Manager",
      markClassName:
        "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/35 dark:text-blue-300",
    },
  },
  {
    keywords: ["store", "branch", "staff"],
    visual: {
      icon: Store,
      label: "Store staff",
      markClassName:
        "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/35 dark:text-orange-300",
    },
  },
];

function getUserVisual(user: UserRow) {
  const normalized = `${user.roleName || ""} ${user.role || ""}`.toLowerCase();

  return (
    userVisuals.find(({ keywords }) =>
      keywords.some((keyword) => normalized.includes(keyword))
    )?.visual || defaultUserVisual
  );
}

function getUserAccessLabel(user: UserRow) {
  const permissionCount = user.permissionCount || 0;

  if (permissionCount >= 20) return "Broad access";
  if (permissionCount > 0) return "Scoped access";
  return "No permissions";
}

function getLegacyRoleClassName(role: string) {
  const normalized = role.toUpperCase();

  if (normalized === "ADMIN") {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-300";
  }

  if (normalized === "MANAGER") {
    return "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900/60 dark:bg-orange-950/35 dark:text-orange-300";
  }

  if (normalized === "CASHIER") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-300";
  }

  return "border-stone-200 bg-stone-50 text-stone-700 dark:border-stone-800 dark:bg-stone-950/35 dark:text-stone-300";
}

function formatPermissionCount(count: number) {
  return `${count.toLocaleString()} ${count === 1 ? "permission" : "permissions"}`;
}

function UserMark({ user }: { user: UserRow }) {
  const visual = getUserVisual(user);
  const Icon = visual.icon;

  return (
    <span
      aria-label={`${visual.label} account icon`}
      className={cn(
        "relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-2xl border shadow-[inset_0_1px_0_color-mix(in_oklch,var(--background)_70%,transparent),0_10px_22px_-18px_color-mix(in_oklch,var(--foreground)_60%,transparent)]",
        visual.markClassName
      )}
      title={visual.label}
    >
      <Icon className="relative z-10 size-5" strokeWidth={2.3} />
    </span>
  );
}

function UserRoleBadge({ user }: { user: UserRow }) {
  const visual = getUserVisual(user);
  const Icon = visual.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        "h-8 gap-1.5 rounded-full px-3.5 font-semibold shadow-[inset_0_1px_0_color-mix(in_oklch,var(--background)_70%,transparent)]",
        visual.markClassName
      )}
    >
      <Icon className="size-3.5" />
      {user.roleName || "No role assigned"}
    </Badge>
  );
}

export function UsersPageClient() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);

  const [meta, setMeta] = useState<ApiMeta>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  const [page, setPage] = useState(1);
  const [limit] = useState("10");

  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  const [form, setForm] = useState(emptyForm);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  async function loadRoles() {
    try {
      const res = await fetch("/api/roles?limit=1000", {
        cache: "no-store",
      });

      const json = await res.json();

      if (res.ok && json.success) {
        setRoles(json.data || []);
      }
    } catch {
      toast.error("Failed to load roles.");
    }
  }

  async function loadUsers() {
    setIsLoading(true);

    const params = new URLSearchParams({
      page: String(page),
      limit,
    });

    if (appliedSearch) {
      params.set("search", appliedSearch);
    }

    try {
      const res = await fetch(`/api/users?${params.toString()}`, {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load users.");
      }

      setUsers(json.data || []);
      setMeta(
        json.meta || {
          page,
          limit: Number(limit),
          total: 0,
          totalPages: 1,
        }
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load users."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRoles();
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, appliedSearch]);

  function openAddDialog() {
    setEditingUser(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEditDialog(user: UserRow) {
    setEditingUser(user);

    setForm({
      name: user.name || "",
      email: user.email || "",
      password: "",
      role: user.role || "USER",
      roleId: user.roleId || "",
    });

    setDialogOpen(true);
  }

  function updateForm(name: keyof typeof emptyForm, value: string) {
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function applySearch() {
    setAppliedSearch(search.trim());
    setPage(1);
  }

  function resetSearch() {
    setSearch("");
    setAppliedSearch("");
    setPage(1);
  }

  async function saveUser() {
    if (!form.name.trim()) {
      toast.error("User name is required.");
      return;
    }

    if (!form.email.trim()) {
      toast.error("Email is required.");
      return;
    }

    if (!editingUser && !form.password.trim()) {
      toast.error("Password is required.");
      return;
    }

    if (!form.roleId) {
      toast.error("Role is required.");
      return;
    }

    setIsSaving(true);

    try {
      const url = editingUser ? `/api/users/${editingUser._id}` : "/api/users";

      const res = await fetch(url, {
        method: editingUser ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          roleId: form.roleId,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to save user.");
      }

      toast.success(json.message || "User saved successfully.");

      setDialogOpen(false);
      setEditingUser(null);
      setForm(emptyForm);

      await loadUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save user.");
    } finally {
      setIsSaving(false);
    }
  }

  async function disableUser(user: UserRow) {
    const confirmed = window.confirm(`Disable user ${user.name}?`);

    if (!confirmed) return;

    try {
      const res = await fetch(`/api/users/${user._id}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to disable user.");
      }

      toast.success(json.message || "User disabled successfully.");
      await loadUsers();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to disable user."
      );
    }
  }

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Users"
        description="Create users and assign role-based permissions."
        actions={
          <Button onClick={openAddDialog} className="rounded-xl">
            <Plus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        }
      />

      <Card className="rounded-2xl border-slate-200 bg-card shadow-sm dark:border-border">
        <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-10 rounded-xl border-slate-200 bg-white pl-9 shadow-[inset_0_1px_0_color-mix(in_oklch,var(--background)_72%,transparent)] dark:border-border dark:bg-background"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search user name or email..."
              onKeyDown={(event) => {
                if (event.key === "Enter") applySearch();
              }}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={applySearch}>
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>

            <Button variant="secondary" onClick={resetSearch}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-2xl border-slate-200 bg-card shadow-sm dark:border-border">
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-[radial-gradient(circle_at_88%_0%,color-mix(in_oklch,var(--brand-orange)_18%,transparent),transparent_18rem),linear-gradient(135deg,oklch(0.99_0.01_58),oklch(0.965_0.024_55))] p-5 md:flex-row md:items-center md:justify-between dark:border-border dark:bg-none">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-primary">
                Access Directory
              </p>
              <h2 className="text-lg font-black text-foreground">
                User accounts
              </h2>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge
                variant="outline"
                className="h-7 gap-1.5 rounded-full border-slate-200 bg-white/75 px-3 font-semibold text-slate-700 dark:border-border dark:bg-background/50 dark:text-foreground"
              >
                <UserRoundCog className="size-3.5" />
                {meta.total.toLocaleString()} users
              </Badge>

              <Badge
                variant="outline"
                className="h-7 gap-1.5 rounded-full border-orange-200 bg-orange-50 px-3 font-semibold text-orange-800 dark:border-orange-900/60 dark:bg-orange-950/35 dark:text-orange-300"
              >
                <ShieldCheck className="size-3.5" />
                Role assignments
              </Badge>
            </div>
          </div>

          <div className="p-5">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_48px_-42px_color-mix(in_oklch,var(--foreground)_58%,transparent)] dark:border-border dark:bg-card">
              <Table className="min-w-[920px]">
                <TableHeader className="bg-black">
                  <TableRow>
                    <TableHead className="px-5 py-3 text-center text-primary-foreground">
                      Name
                    </TableHead>
                    <TableHead className="px-5 py-3 text-primary-foreground">
                      Email
                    </TableHead>
                    <TableHead className="px-5 py-3 text-primary-foreground">
                      Role
                    </TableHead>
                    <TableHead className="px-5 py-3 text-center text-primary-foreground">
                      Permissions
                    </TableHead>
                    <TableHead className="px-5 py-3 text-center text-primary-foreground">
                      Legacy Role
                    </TableHead>
                    <TableHead className="px-5 py-3 text-center text-primary-foreground">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center">
                        <div className="flex flex-col items-center gap-3 text-muted-foreground">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                          <span className="text-sm">Loading users...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : users.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="h-32 text-center text-muted-foreground"
                      >
                        <div className="flex flex-col items-center gap-3">
                          <span className="grid size-12 place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-slate-500 dark:border-border dark:bg-muted/30 dark:text-muted-foreground">
                            <UserRoundCog className="size-5" />
                          </span>
                          <span className="font-medium text-foreground">
                            No users found.
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((user) => (
                      <TableRow
                        key={user._id}
                        className="group border-slate-100 bg-white hover:bg-orange-50/45 dark:border-border dark:bg-card dark:hover:bg-muted/35"
                      >
                        <TableCell className="min-w-[225px] px-5 py-4">
                          <div className="flex items-center gap-3">
                            <UserMark user={user} />

                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-black tracking-wide text-slate-950 dark:text-slate-50">
                                  {user.name}
                                </span>
                              </div>

                              <p className="mt-1 text-xs font-medium text-muted-foreground">
                                {getUserAccessLabel(user)}
                              </p>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="min-w-[220px] px-5 py-4">
                          <span className="inline-flex items-center gap-2 text-slate-600 dark:text-muted-foreground">
                            <Mail className="size-4 text-muted-foreground" />
                            {user.email}
                          </span>
                        </TableCell>

                        <TableCell className="px-5 py-4">
                          <UserRoleBadge user={user} />
                        </TableCell>

                        <TableCell className="px-5 py-4 text-center">
                          <Badge
                            variant="outline"
                            className="h-8 gap-1.5 rounded-full border-amber-200 bg-amber-50 px-3.5 font-semibold text-amber-800 shadow-[inset_0_1px_0_color-mix(in_oklch,var(--background)_70%,transparent)] dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-300"
                          >
                            <KeyRound className="size-3.5" />
                            {formatPermissionCount(user.permissionCount || 0)}
                          </Badge>
                        </TableCell>

                        <TableCell className="px-5 py-4 text-center">
                          <Badge
                            variant="outline"
                            className={cn(
                              "h-8 gap-1.5 rounded-full px-3.5 font-semibold shadow-[inset_0_1px_0_color-mix(in_oklch,var(--background)_70%,transparent)]",
                              getLegacyRoleClassName(user.role || "USER")
                            )}
                          >
                            {String(user.role || "USER").toUpperCase() ===
                            "ADMIN" ? (
                              <ShieldCheck className="size-3.5" />
                            ) : (
                              <UserRoundCog className="size-3.5" />
                            )}
                            {user.role || "USER"}
                          </Badge>
                        </TableCell>

                        <TableCell className="px-5 py-4">
                          <div className="flex justify-center gap-2">
                            <Button
                              aria-label={`Edit ${user.name}`}
                              title={`Edit ${user.name}`}
                              size="icon-sm"
                              variant="outline"
                              className="size-8 rounded-full bg-white text-slate-700 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-800 dark:bg-background dark:text-foreground"
                              onClick={() => openEditDialog(user)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>

                            <Button
                              aria-label={`Disable ${user.name}`}
                              title={`Disable ${user.name}`}
                              size="icon-sm"
                              variant="destructive"
                              className="size-8 rounded-full"
                              onClick={() => disableUser(user)}
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <Button
                variant="outline"
                className="rounded-full"
                disabled={page <= 1 || isLoading}
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Previous
              </Button>

              <span className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 dark:border-border dark:bg-background dark:text-muted-foreground">
                Page {meta.page} of {meta.totalPages}
              </span>

              <Button
                variant="outline"
                className="rounded-full"
                disabled={page >= meta.totalPages || isLoading}
                onClick={() =>
                  setPage((current) => Math.min(current + 1, meta.totalPages))
                }
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl font-black">
              <UserRoundCog className="h-6 w-6" />
              {editingUser ? "Edit User" : "Add User"}
            </DialogTitle>

            <DialogDescription>
              Assign a system role to control user permissions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(event) => updateForm("name", event.target.value)}
                  placeholder="Full name"
                />
              </div>

              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(event) => updateForm("email", event.target.value)}
                  placeholder="email@example.com"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>
                  Password{" "}
                  {editingUser ? (
                    <span className="text-xs text-muted-foreground">
                      optional
                    </span>
                  ) : null}
                </Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(event) =>
                    updateForm("password", event.target.value)
                  }
                  placeholder={
                    editingUser ? "Leave blank to keep password" : "Password"
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={form.roleId}
                  onValueChange={(value) => updateForm("roleId", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>

                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role._id} value={role._id}>
                        {role.name} — {role.permissionCount} permissions
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Legacy Role</Label>
              <Select
                value={form.role}
                onValueChange={(value) => updateForm("role", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select legacy role" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                  <SelectItem value="CASHIER">Cashier</SelectItem>
                  <SelectItem value="STAFF">Staff</SelectItem>
                  <SelectItem value="USER">User</SelectItem>
                </SelectContent>
              </Select>

              <p className="text-xs text-muted-foreground">
                This keeps compatibility with your existing auth code. The new
                permission system uses the selected Role above.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={isSaving}
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>

            <Button type="button" disabled={isSaving} onClick={saveUser}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {editingUser ? "Update User" : "Save User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
