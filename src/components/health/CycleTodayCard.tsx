"use client";

import Link from "next/link";
import { IconChevronRight } from "@/components/icons";
import { Panel } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { interpolate } from "@/i18n/format";
import { localDateKey } from "@/lib/dates";
import { cycleStatus } from "@/lib/health/cycle";
import { canUseCycle } from "@/lib/health/cycle-access";
import { cyclePrefs } from "@/lib/health/cycle-prefs";
import { cycleConsent, cyclePeriods } from "@/lib/health/store";
import { profile } from "@/lib/profile/store";
import { useLocalData } from "@/lib/storage/db";
import { nextPeriodLabel } from "./cycle-labels";

// Il ciclo in breve nella pagina Oggi: solo se il Ciclo è attivo (canUseCycle),
// se ci sono dati e se l'utente non l'ha nascosto (chi vede lo schermo).
export function CycleTodayCard() {
  const { locale, dict } = useI18n();
  const ready = useLocalData();
  const access = canUseCycle(profile.use(), cycleConsent.use());
  const periods = cyclePeriods.use();
  const { showInToday } = cyclePrefs.use();
  if (!ready || access !== "ok" || !showInToday) return null;
  const status = cycleStatus(periods, localDateKey());
  if (!status) return null;
  const t = dict.health.cycle.status;

  return (
    <Link href="/health/cycle" className="block">
      <Panel className="flex items-center gap-3 transition-transform duration-150 active:scale-[0.99]">
        <div className="min-w-0 flex-1">
          <p className="eyebrow mb-1">
            {dict.health.sections.cycle} · {interpolate(t.day, { n: status.day })}
          </p>
          <h2 className="text-headline font-semibold">{t.phases[status.phase]}</h2>
          <p className="mt-1 text-subhead text-muted">{nextPeriodLabel(locale, dict, status)}</p>
        </div>
        <IconChevronRight width={20} height={20} className="shrink-0 text-muted" />
      </Panel>
    </Link>
  );
}
