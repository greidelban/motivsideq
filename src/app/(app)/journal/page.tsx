import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";
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
      <PageHeader title={dict.journal.title} />
      <ComingSoon what={dict.journal.comingSoonWhat} />
    </>
  );
}
