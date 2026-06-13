// app/(dashboard)/stock-transfers/[id]/print/page.tsx
import { TransferPrintClient } from "@/components/stock-transfers/TransferPrintClient";

export default async function TransferPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <TransferPrintClient transferId={id} />;
}
