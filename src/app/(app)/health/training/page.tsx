import type { Metadata } from "next";
import { DisclaimerNote } from "@/components/Disclaimer";
import { TrainingView } from "@/components/health/TrainingView";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.health.sections.training };
}

export default function Page() {
  return (
    <div className="space-y-4">
      <TrainingView />
      <DisclaimerNote section="training" />
    </div>
  );
}
