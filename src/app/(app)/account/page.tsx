import type { Metadata } from "next";
import { AccountView } from "@/components/account/AccountView";
import { PageHeader } from "@/components/ui";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.settings.account.title };
}

export default async function AccountPage() {
  const { dict } = await getI18n();
  return (
    <>
      <PageHeader title={dict.settings.account.title} back={{ href: "/settings", label: dict.common.back }} />
      <AccountView />
    </>
  );
}
