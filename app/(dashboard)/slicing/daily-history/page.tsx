import { DailySlicingHistoryPageClient } from "@/components/slicing/DailySlicingHistoryPageClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Daily Slicing History",
};

export default function DailySlicingHistoryPage() {
  return <DailySlicingHistoryPageClient />;
}
