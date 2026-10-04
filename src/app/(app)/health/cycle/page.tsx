import type { Metadata } from "next";
import { DisclaimerNote } from "@/components/Disclaimer";
import { CycleView } from "@/components/health/CycleView";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.health.sections.cycle };
}

export default function Page() {
  return (
    <div className="space-y-4">
      <CycleView />
      <DisclaimerNote section="cycle" />
    </div>
  );
}
