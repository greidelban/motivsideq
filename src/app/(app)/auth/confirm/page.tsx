import type { Metadata } from "next";
import { Suspense } from "react";
import { ConfirmView } from "@/components/account/ConfirmView";
import { PageHeader } from "@/components/ui";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.settings.account.title };
}

// Arrivo dai link nelle email di Supabase: la verifica avviene nel browser.
export default async function ConfirmPage() {
  const { dict } = await getI18n();
  return (
    <>
      <PageHeader title={dict.settings.account.title} />
      <Suspense>
        <ConfirmView />
      </Suspense>
    </>
  );
}
