// app/(dashboard)/payments/add/page.tsx
import { RecordPaymentPageClient } from "@/components/payments/RecordPaymentPageClient";

export default async function AddPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const params = await searchParams;

  return <RecordPaymentPageClient initialCustomerId={params.customerId || ""} />;
}