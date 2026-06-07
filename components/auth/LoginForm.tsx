"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";

import { LetsonMark } from "@/components/brand/LetsonMark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsLoading(true);

    const result = await signIn("credentials", {
      identifier: username,
      username,
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
    <Card className="surface-elevated w-full max-w-md rounded-2xl">
      <CardHeader className="space-y-2 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center">
          <LetsonMark className="h-16 w-16" />
        </div>
        <CardTitle className="text-2xl">LETSON Inventory</CardTitle>
        <p className="text-sm text-muted-foreground">
          Sign in to manage dashboard, inventory, sales, payments, and users.
        </p>
      </CardHeader>

      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Enter username or email"
              autoComplete="username"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          <Button className="w-full" disabled={isLoading} type="submit">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <LogIn className="mr-2 h-4 w-4" />
                Login
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
