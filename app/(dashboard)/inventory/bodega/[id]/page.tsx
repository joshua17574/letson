// app/(dashboard)/inventory/bodega/[id]/page.tsx
import { BodegaStockMovementDetailsPageClient } from "@/components/inventory/BodegaStockMovementDetailsPageClient";

export default async function BodegaStockMovementDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <BodegaStockMovementDetailsPageClient productId={id} />;
}