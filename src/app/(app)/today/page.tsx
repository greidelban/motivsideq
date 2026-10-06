import type { Metadata } from "next";
import Link from "next/link";
import { WakeUpCard } from "@/components/brain/WakeUpCard";
import { CycleTodayCard } from "@/components/health/CycleTodayCard";
import { IconChevronRight } from "@/components/icons";
import { JournalTodayCard } from "@/components/journal/JournalTodayCard";
import { QuoteCard } from "@/components/quotes/QuoteCard";
import { SponsorCard } from "@/components/quotes/SponsorCard";
import { TodayHeader } from "@/components/TodayHeader";
import { Panel } from "@/components/ui";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.today.title };
}

const SECTIONS = [
  { href: "/health/training", key: "training" },
  { href: "/health/food", key: "food" },
  { href: "/insights", key: "insights" },
] as const;

export default async function TodayPage() {
  const { dict } = await getI18n();
  return (
    <>
      <TodayHeader />
      <div className="space-y-3">
        <QuoteCard />
        <WakeUpCard hideWhenDone />
        <JournalTodayCard />
        <CycleTodayCard />
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
        {/* Unico posto dell'app con la carta sponsor (solo col consenso, solo per un giorno). */}
        <SponsorCard />
      </div>
    </>
  );
}
