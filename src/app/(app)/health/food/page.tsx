import type { Metadata } from "next";
import { DisclaimerNote } from "@/components/Disclaimer";
import { FoodView } from "@/components/health/FoodView";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.health.sections.food };
}

export default function Page() {
  return (
    <div className="space-y-4">
      <FoodView />
      <DisclaimerNote section="food" />
    </div>
  );
}
