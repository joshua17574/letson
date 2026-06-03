// app/(dashboard)/unauthorized/page.tsx
import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">
          Access denied
        </h1>

        <p className="mt-3 text-sm text-gray-600">
          Your account does not have permission to open this page.
        </p>

        <Link
          href="/dashboard"
          className="mt-6 inline-flex rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Go back to dashboard
        </Link>
      </div>
    </div>
  );
}