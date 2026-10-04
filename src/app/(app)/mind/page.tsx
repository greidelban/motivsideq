import type { Metadata } from "next";
import { GameList } from "@/components/brain/GameList";
import { WakeUpCard } from "@/components/brain/WakeUpCard";
import { LightLevel } from "@/components/light/LightLevel";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.mind.title };
}

export default async function MindPage() {
  const { dict } = await getI18n();
  return (
    <>
      <LightLevel energy={0.42} />
      <PageHeader eyebrow={dict.mind.eyebrow} title={dict.mind.title} />
      <div className="space-y-6">
        <WakeUpCard />
        <Link href="/mind/light" className="glass flex items-center gap-4 rounded-xl p-4 transition-transform duration-150 active:scale-[0.99]">
          <span className="grid size-11 shrink-0 place-items-center rounded-full card text-title3 text-ink" aria-hidden="true">
            ✦
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-headline font-semibold">{dict.mind.light.title}</span>
            <span className="block truncate text-footnote text-muted">{dict.mind.light.tagline}</span>
          </span>
        </Link>
        <section>
          <h2 className="eyebrow mb-3">{dict.mind.singleExercises}</h2>
          <GameList />
        </section>
      </div>
    </>
  );
}
