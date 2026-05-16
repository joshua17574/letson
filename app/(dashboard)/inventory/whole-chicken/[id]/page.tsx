// app/(dashboard)/inventory/whole-chicken/[id]/page.tsx
import { WholeChickenMovementDetailsPageClient } from "@/components/inventory/WholeChickenMovementDetailsPageClient";

export default async function WholeChickenMovementDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <WholeChickenMovementDetailsPageClient productId={id} />;
}