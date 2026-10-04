import type { Metadata } from "next";
import Link from "next/link";
import { WakeUpCard } from "@/components/brain/WakeUpCard";
import { TodayHeader } from "@/components/TodayHeader";
import { Panel } from "@/components/ui";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.today.title };
}

const SECTIONS = [
  { href: "/journal", key: "journal" },
  { href: "/gym", key: "gym" },
  { href: "/food", key: "food" },
] as const;

export default async function TodayPage() {
  const { dict } = await getI18n();
  return (
    <>
      <TodayHeader />
      <div className="space-y-3">
        <WakeUpCard hideWhenDone />
        {SECTIONS.map(({ href, key }) => (
          <Link key={href} href={href} className="block">
            <Panel className="transition-transform duration-150 active:scale-[0.99]">
              <h2 className="text-headline font-semibold">{dict.today.sections[key].title}</h2>
              <p className="mt-1 text-subhead text-muted">{dict.today.sections[key].text}</p>
            </Panel>
          </Link>
        ))}
      </div>
    </>
  );
}
