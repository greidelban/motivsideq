import type { Metadata } from "next";
import { JournalView } from "@/components/journal/JournalView";
import { LightLevel } from "@/components/light/LightLevel";
import { PageHeader } from "@/components/ui";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.journal.title };
}

export default async function Page() {
  const { dict } = await getI18n();
  return (
    <>
      {/* Luce bassa: è la schermata in cui si legge e si scrive. */}
      <LightLevel energy={0.24} />
      <PageHeader title={dict.journal.title} />
      <JournalView />
    </>
  );
}
