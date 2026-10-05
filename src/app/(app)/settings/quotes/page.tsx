import type { Metadata } from "next";
import { QuoteSettings } from "@/components/quotes/QuoteSettings";
import { PageHeader } from "@/components/ui";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.quotes.settings.title };
}

export default async function QuoteSettingsPage() {
  const { dict } = await getI18n();
  return (
    <>
      <PageHeader title={dict.quotes.settings.title} back={{ href: "/settings", label: dict.common.back }} />
      <QuoteSettings />
    </>
  );
}
