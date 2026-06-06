"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Boxes,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  LogIn,
  PackageCheck,
  ShieldCheck,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const businessHighlights = [
  {
    label: "Inventory control",
    description: "Monitor bodega stocks, packs, loose pcs, and product movement.",
    icon: Boxes,
  },
  {
    label: "Daily operations",
    description: "Track sales, payments, expenses, deliveries, and slicing activities.",
    icon: BarChart3,
  },
  {
    label: "Owner visibility",
    description: "View one-glance business summaries with role-protected access.",
    icon: ShieldCheck,
  },
];

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedUsername = username.trim();

    if (!trimmedUsername || !password) {
      toast.error("Enter your username and password.");
      return;
    }

    setIsLoading(true);

    const result = await signIn("credentials", {
      identifier: trimmedUsername,
      username: trimmedUsername,
      password,
      redirect: false,
    });

    setIsLoading(false);

    if (result?.error) {
      toast.error("Invalid username or password.");
      return;
    }

    toast.success("Login successful.");
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_#e0f2fe,_transparent_34%),linear-gradient(135deg,_#f8fafc_0%,_#eef2ff_48%,_#f8fafc_100%)] text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid w-full overflow-hidden rounded-[2rem] border border-white/70 bg-white/70 shadow-2xl shadow-slate-200/80 backdrop-blur-xl lg:grid-cols-[1.15fr_0.85fr]">
          <section className="relative hidden min-h-[720px] overflow-hidden bg-slate-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.35),transparent_30%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.28),transparent_28%),radial-gradient(circle_at_50%_90%,rgba(245,158,11,0.2),transparent_28%)]" />
            <div className="absolute -right-20 top-16 h-72 w-72 rounded-full border border-white/10" />
            <div className="absolute -bottom-24 -left-16 h-96 w-96 rounded-full border border-white/10" />

            <div className="relative z-10">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-xl font-black text-slate-950 shadow-xl">
                  ISAY
                </div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.35em] text-sky-200">
                    ISAY Fried Chicken
                  </p>
                  <h1 className="text-2xl font-black tracking-tight">
                    Business Operations System
                  </h1>
                </div>
              </div>

              <div className="mt-16 max-w-xl">
              
                <h2 className="mt-4 text-5xl font-black leading-tight tracking-tight">
                  Manage daily sales, slicing, inventory, and cash flow in one system.
                </h2>
                <p className="mt-5 text-base leading-7 text-slate-300">
                  Built for fast counter work, clear owner reporting, and reliable stock movement across bodega products, grocery inventory, deliveries, and chicken slicing.
                </p>
              </div>
            </div>

            <div className="relative z-10 grid gap-4">
              {businessHighlights.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.label}
                    className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold">{item.label}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-300">
                        {item.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="flex min-h-[640px] items-center justify-center p-5 sm:p-8 lg:p-12">
            <div className="w-full max-w-md">
              <div className="mb-8 text-center lg:hidden">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-950 text-xl font-black text-white shadow-xl">
                  ISA
                </div>
                <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950">
                  LETSON Inventory
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  Secure access to your business operations.
                </p>
              </div>

              <Card className="rounded-[1.75rem] border-slate-200/80 bg-white/95 shadow-xl shadow-slate-200/70">
                <CardContent className="p-6 sm:p-8">
                  <div className="mb-7">
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-700">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Secure login
                    </div>
                    <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950">
                      Welcome back
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Sign in to manage dashboard, inventory, sales, payments, expenses, users, and reports.
                    </p>
                  </div>

                  <form className="space-y-5" onSubmit={handleSubmit}>
                    <div className="space-y-2">
                      <Label htmlFor="username" className="font-semibold text-slate-700">
                        Username or email
                      </Label>
                      <div className="relative">
                        <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          id="username"
                          value={username}
                          onChange={(event) => setUsername(event.target.value)}
                          placeholder="Enter username or email"
                          autoComplete="username"
                          className="h-12 rounded-xl border-slate-200 bg-slate-50 pl-10 text-base shadow-none focus-visible:bg-white"
                          disabled={isLoading}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password" className="font-semibold text-slate-700">
                        Password
                      </Label>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          id="password"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder="Enter password"
                          type={showPassword ? "text" : "password"}
                          autoComplete="current-password"
                          className="h-12 rounded-xl border-slate-200 bg-slate-50 pl-10 pr-11 text-base shadow-none focus-visible:bg-white"
                          disabled={isLoading}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((current) => !current)}
                          className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          disabled={isLoading}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <Button
                      className="h-12 w-full rounded-xl text-base font-bold shadow-lg shadow-slate-200"
                      disabled={isLoading}
                      type="submit"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Signing in...
                        </>
                      ) : (
                        <>
                          <LogIn className="mr-2 h-4 w-4" />
                          Login to dashboard
                        </>
                      )}
                    </Button>
                  </form>

                  <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start gap-3">
                      <PackageCheck className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
                      <div>
                        <p className="text-sm font-bold text-slate-800">
                          Role-protected Access
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          Owners, managers, and staff only see the modules allowed by their assigned role.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <p className="mt-5 text-center text-xs text-slate-500">
                Built for desktop, tablet, and mobile operations
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
