import type { ReactNode } from "react";
import { HealthNav } from "@/components/health/HealthNav";
import { LightLevel } from "@/components/light/LightLevel";
import { PageHeader } from "@/components/ui";
import { getI18n } from "@/i18n/server";

// Salute riunisce Allenamento, Cibo e Ciclo sotto un'unica scheda.
export default async function HealthLayout({ children }: { children: ReactNode }) {
  const { dict } = await getI18n();
  return (
    <>
      <LightLevel energy={0.34} />
      <PageHeader title={dict.health.title} />
      <HealthNav />
      {children}
    </>
  );
}
