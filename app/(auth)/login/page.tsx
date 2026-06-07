import { LoginForm } from "@/components/auth/LoginForm";

export default async function LoginPage() {
  // const session = await getServerSession(authOptions);

  // if (session?.user) {
  //   redirect("/");
  // }

  return (
    <main className="ambient-auth relative flex min-h-dvh items-center justify-center overflow-hidden p-4">
      <div className="ambient-grid pointer-events-none absolute inset-0 opacity-70" />
      <div
        aria-hidden="true"
        className="motion-float pointer-events-none absolute left-[12%] top-[16%] h-24 w-24 rounded-[2rem] border border-border bg-card/40"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[12%] right-[14%] h-32 w-32 rounded-full border border-border bg-background/30"
      />
      <div className="relative w-full max-w-md">
        <LoginForm />
      </div>
    </main>
  );
}
