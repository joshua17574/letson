// app/(auth)/login/page.tsx
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/LoginForm";
import { authOptions } from "@/lib/auth";

export default async function LoginPage() {
  // const session = await getServerSession(authOptions);

  // if (session?.user) {
  //   redirect("/");
  // }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-red-600 via-orange-500 to-yellow-400 p-4">
      <LoginForm />
    </main>
  );
}