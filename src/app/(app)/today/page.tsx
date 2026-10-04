import type { Metadata } from "next";
import Link from "next/link";
import { WakeUpCard } from "@/components/brain/WakeUpCard";
import { IconChevronRight } from "@/components/icons";
import { TodayHeader } from "@/components/TodayHeader";
import { Panel } from "@/components/ui";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.today.title };
}

const SECTIONS = [
  { href: "/journal", key: "journal" },
  { href: "/health/training", key: "training" },
  { href: "/health/food", key: "food" },
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
            {/* La freccia dice che la scheda si apre (come nelle liste di iOS). */}
            <Panel className="flex items-center gap-3 transition-transform duration-150 active:scale-[0.99]">
              <div className="min-w-0 flex-1">
                <h2 className="text-headline font-semibold">{dict.today.sections[key].title}</h2>
                <p className="mt-1 text-subhead text-muted">{dict.today.sections[key].text}</p>
              </div>
              <IconChevronRight width={20} height={20} className="shrink-0 text-muted" />
            </Panel>
          </Link>
        ))}
      </div>
    </>
  );
}
