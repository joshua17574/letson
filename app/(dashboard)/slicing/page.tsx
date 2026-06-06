import { SliceHistoryPageClient } from "@/components/slicing/SliceHistoryPageClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Slice History",
};

export default function SliceHistoryPage() {
  return <SliceHistoryPageClient />;
}
