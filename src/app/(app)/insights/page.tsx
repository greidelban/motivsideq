import type { Metadata } from "next";
import { InsightsView } from "@/components/insights/InsightsView";
import { LightLevel } from "@/components/light/LightLevel";
import { PageHeader } from "@/components/ui";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.insights.title };
}

export default async function Page() {
  const { dict } = await getI18n();
  return (
    <>
      <LightLevel energy={0.3} />
      <PageHeader title={dict.insights.title} back={{ href: "/today", label: dict.common.back }} />
      <InsightsView />
    </>
  );
}
