"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Panel } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { formatHours, interpolate, plural } from "@/i18n/format";
import { daysBetween, localDateKey } from "@/lib/dates";
import {
  type CycleStatus,
  FLOWS,
  SYMPTOMS,
  cycleStatus,
  endPeriod,
  setFlow,
  sortPeriods,
  startPeriod,
  togglePeriodDay,
  toggleSymptom,
} from "@/lib/health/cycle";
import { cycleCalendar } from "@/lib/health/cycle-calendar";
import { cycleConsent, cycleDayLogs, cyclePeriods, deleteCycleData } from "@/lib/health/store";
import { canUseCycle } from "@/lib/health/cycle-access";
import { type Level, SCALES } from "@/lib/journal/journal";
import { checkIns } from "@/lib/journal/store";
import { CYCLE_POLICY_VERSION } from "@/lib/legal";
import { profile } from "@/lib/profile/store";
import { useLocalData } from "@/lib/storage/db";
import { Chip, ChipGroup, Notice } from "./Chip";
import { CycleCalendar } from "./CycleCalendar";
import { CycleReminders } from "./CycleReminders";
import { nextPeriodLabel } from "./cycle-labels";
import { DeleteButton, useShortDate } from "./shared";

export function CycleView() {
  const hydrated = useLocalData();
  if (!hydrated) return <div className="min-h-96" />;
  return <Cycle />;
}

// Prima di tutto: sesso, età (solo maggiorenni) e consenso, decisi da canUseCycle.
// Senza, nessun dato si legge né si scrive.
function Cycle() {
  const { dict } = useI18n();
  const t = dict.health.cycle;
  const router = useRouter();
  const consent = cycleConsent.use();
  const access = canUseCycle(profile.use(), consent);

  // Il Ciclo non deve comparire da nessuna parte: anche aprendo l'indirizzo a mano si torna ad Allenamento.
  useEffect(() => {
    if (access === "hidden") router.replace("/health/training");
  }, [access, router]);

  if (access === "hidden") return null;
  if (access === "needBirth") {
    return (
      <Panel>
        <h2 className="mb-2 text-headline font-semibold">{t.needBirth.title}</h2>
        <p className="text-subhead text-ink-2">{t.needBirth.text}</p>
        <Link href="/settings#profile" className="btn btn-primary mt-4">
          {dict.common.openSettings}
        </Link>
      </Panel>
    );
  }
  if (access === "tooYoung") {
    return (
      <Panel>
        <h2 className="mb-2 text-headline font-semibold">{t.adultsOnly.title}</h2>
        <p className="text-subhead text-ink-2">{t.adultsOnly.text}</p>
      </Panel>
    );
  }
  if (access === "needConsent") {
    return (
      <Panel>
        <h2 className="mb-2 text-headline font-semibold">{t.consent.title}</h2>
        <p className="text-subhead text-ink-2">{t.consent.text}</p>
        <p className="mt-3 text-footnote text-muted">{t.consent.method}</p>
        <button
          type="button"
          className="btn btn-primary mt-4 w-full"
          onClick={() => cycleConsent.set({ acceptedAt: new Date().toISOString(), policyVersion: CYCLE_POLICY_VERSION, enabled: true })}
        >
          {t.consent.accept}
        </button>
      </Panel>
    );
  }
  if (access === "paused") {
    return (
      <>
        <Panel>
          <h2 className="mb-2 text-headline font-semibold">{t.paused.title}</h2>
          <p className="text-subhead text-ink-2">{t.paused.text}</p>
          <button
            type="button"
            className="btn btn-primary mt-4 w-full"
            onClick={() => cycleConsent.set((c) => (c ? { ...c, enabled: true } : c))}
          >
            {t.paused.resume}
          </button>
        </Panel>
        <RemoveAll />
      </>
    );
  }
  return <Tracker />;
}

function Tracker() {
  const { locale, dict } = useI18n();
  const t = dict.health.cycle;
  const periods = cyclePeriods.use();
  const logs = cycleDayLogs.use();
  const today = localDateKey();
  const status = cycleStatus(periods, today);
  const marks = cycleCalendar(periods, logs, status, today);
  const [selected, setSelected] = useState(today);
  const shortDate = useShortDate();
  const dayRef = useRef<HTMLElement>(null);

  // Il giorno toccato si apre sotto il calendario: se è fuori schermo, ci si scorre.
  function select(day: string) {
    setSelected(day);
    requestAnimationFrame(() => {
      const el = dayRef.current;
      if (!el || el.getBoundingClientRect().top < window.innerHeight * 0.6) return;
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
    });
  }

  return (
    <>
      {status ? (
        <StatusPanel status={status} today={today} todayIsPeriod={marks.get(today)?.period === "logged"} />
      ) : (
        <Panel>
          <h2 className="mb-2 text-headline font-semibold">{t.empty.title}</h2>
          <p className="text-subhead text-ink-2">{t.empty.text}</p>
          <QuickStart today={today} />
        </Panel>
      )}

      <CycleCalendar marks={marks} today={today} selected={selected} onSelect={select} />
      <DayPanel ref={dayRef} day={selected} today={today} isPeriod={marks.get(selected)?.period === "logged"} />

      {status && (
        <Panel>
          <h2 className="mb-3 text-headline font-semibold">{t.stats.title}</h2>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="card px-2 py-3">
              <p className="num text-title3 font-semibold">{plural(locale, status.stats.cycleLength, t.stats.days)}</p>
              <p className="text-caption text-muted">{t.stats.cycle}</p>
            </div>
            <div className="card px-2 py-3">
              <p className="num text-title3 font-semibold">{plural(locale, status.stats.periodLength, t.stats.days)}</p>
              <p className="text-caption text-muted">{t.stats.period}</p>
            </div>
          </div>
          <p className="mt-3 text-footnote text-muted">
            {status.stats.basedOn === 0 ? t.stats.standard : plural(locale, status.stats.basedOn, t.stats.basedOn)}
            {status.stats.shortest !== null && status.stats.basedOn > 1 && (
              <> {interpolate(t.stats.range, { min: status.stats.shortest, max: status.stats.longest! })}</>
            )}
          </p>
          {status.stats.irregular && <Notice tone="warning">{t.stats.irregular}</Notice>}
        </Panel>
      )}

      {periods.length > 0 && (
        <Panel>
          <h2 className="mb-3 text-headline font-semibold">{t.history.title}</h2>
          <ul className="space-y-2">
            {sortPeriods(periods)
              .reverse()
              .map((p) => {
                const ongoing = p.end === undefined && status?.currentStart === p.start && status.periodOpen;
                return (
                  <li key={p.id} className="card flex items-center gap-3 py-2 pe-1.5 ps-4">
                    {/* Toccando una mestruazione la si apre nel calendario, per correggerla. */}
                    <button type="button" className="min-h-11 min-w-0 flex-1 text-start text-subhead" onClick={() => select(p.start)}>
                      {shortDate(p.start)}
                      {p.end && ` – ${shortDate(p.end)}`}
                      {ongoing && <span className="text-muted"> · {t.history.ongoing}</span>}
                    </button>
                    {p.end && <p className="num text-footnote text-muted">{plural(locale, daysBetween(p.start, p.end) + 1, t.stats.days)}</p>}
                    <DeleteButton
                      label={interpolate(t.history.delete, { date: shortDate(p.start) })}
                      onClick={() => cyclePeriods.set((prev) => prev.filter((x) => x.id !== p.id))}
                    />
                  </li>
                );
              })}
          </ul>
        </Panel>
      )}

      <CycleReminders />
      <RemoveAll />
    </>
  );
}

function StatusPanel({ status, today, todayIsPeriod }: { status: CycleStatus; today: string; todayIsPeriod: boolean }) {
  const { locale, dict } = useI18n();
  const t = dict.health.cycle.status;
  const shortDate = useShortDate();

  return (
    <Panel>
      <p className="eyebrow mb-1">{interpolate(t.day, { n: status.day })}</p>
      <h2 className="text-title2 font-bold">{t.phases[status.phase]}</h2>
      <p className="mt-1 text-subhead text-ink-2">{t.phaseText[status.phase]}</p>
      <CycleBar status={status} />
      <p className="mt-4 text-headline font-semibold">{nextPeriodLabel(locale, dict, status)}</p>
      <ul className="mt-1 space-y-0.5 text-footnote text-muted">
        {status.daysUntilNext > 0 && <li>{interpolate(t.nextDate, { date: shortDate(status.nextStart) })}</li>}
        {status.phase !== "late" && status.ovulation >= today && (
          <>
            <li>{interpolate(t.fertile, { from: shortDate(status.fertileStart), to: shortDate(status.fertileEnd) })}</li>
            <li>{interpolate(t.ovulation, { date: shortDate(status.ovulation) })}</li>
          </>
        )}
      </ul>
      {status.periodOpen ? <QuickEnd today={today} /> : !todayIsPeriod && <QuickStart today={today} />}
    </Panel>
  );
}

/** "Sono iniziate oggi": un tocco, senza scegliere date. */
function QuickStart({ today }: { today: string }) {
  const { dict } = useI18n();
  return (
    <button
      type="button"
      className="btn btn-primary mt-4 w-full"
      onClick={() => {
        const result = startPeriod(cyclePeriods.get(), today, today, crypto.randomUUID());
        if (result.ok) cyclePeriods.set(result.periods);
      }}
    >
      {dict.health.cycle.quick.started}
    </button>
  );
}

function QuickEnd({ today }: { today: string }) {
  const { dict } = useI18n();
  return (
    <button
      type="button"
      className="btn btn-ghost mt-4 w-full"
      onClick={() => {
        const next = endPeriod(cyclePeriods.get(), today);
        if (next) cyclePeriods.set(next);
      }}
    >
      {dict.health.cycle.quick.ended}
    </button>
  );
}

// Una striscia di giorni del ciclo: mestruazioni (viola), finestra fertile
// (ciano), ovulazione più piena, e un segno sul giorno di oggi.
function CycleBar({ status }: { status: CycleStatus }) {
  const length = Math.max(status.stats.cycleLength, status.day);
  const periodDays = daysBetween(status.currentStart, status.periodEnd) + 1;
  const fertileFrom = daysBetween(status.currentStart, status.fertileStart) + 1;
  const fertileTo = daysBetween(status.currentStart, status.fertileEnd) + 1;
  const ovulationDay = daysBetween(status.currentStart, status.ovulation) + 1;

  return (
    <div className="mt-4 flex h-3 gap-[2px]" aria-hidden="true">
      {Array.from({ length }, (_, i) => {
        const day = i + 1;
        const color =
          day <= periodDays
            ? "bg-primary"
            : day === ovulationDay
              ? "bg-secondary"
              : day >= fertileFrom && day <= fertileTo
                ? "bg-secondary/45"
                : "bg-[var(--control-bg)]";
        const isToday = day === status.day;
        return (
          <span
            key={day}
            className={`flex-1 rounded-full ${color} ${isToday ? "outline-2 outline-offset-2 outline-[var(--text)]" : ""}`}
          />
        );
      })}
    </div>
  );
}

// Il giorno toccato nel calendario: giorno di mestruazioni sì/no, flusso, sintomi.
// I giorni futuri dicono solo che sono stime.
function DayPanel({ day, today, isPeriod, ref }: { day: string; today: string; isPeriod: boolean; ref: React.Ref<HTMLElement> }) {
  const { locale, dict } = useI18n();
  const t = dict.health.cycle;
  const log = cycleDayLogs.use().find((l) => l.day === day);
  const [y, m, d] = day.split("-").map(Number);
  const title =
    day === today
      ? dict.health.food.today
      : new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(new Date(y, m - 1, d));

  return (
    <Panel ref={ref} className="scroll-mt-6 space-y-4">
      <h2 className="text-headline font-semibold first-letter:uppercase" aria-live="polite">
        {title}
      </h2>
      {day > today ? (
        <p className="text-subhead text-ink-2">{t.day.future}</p>
      ) : (
        <>
          <Chip
            active={isPeriod}
            onClick={() => {
              const next = togglePeriodDay(cyclePeriods.get(), day, today, crypto.randomUUID());
              if (next) cyclePeriods.set(next);
            }}
          >
            {t.day.periodDay}
          </Chip>
          <ChipGroup label={t.today.flow}>
            {FLOWS.map((f) => (
              <Chip key={f} active={log?.flow === f} onClick={() => cycleDayLogs.set((prev) => setFlow(prev, day, log?.flow === f ? undefined : f))}>
                {t.today.flows[f]}
              </Chip>
            ))}
          </ChipGroup>
          <ChipGroup label={t.today.symptoms}>
            {SYMPTOMS.map((s) => (
              <Chip key={s} active={log?.symptoms.includes(s) ?? false} onClick={() => cycleDayLogs.set((prev) => toggleSymptom(prev, day, s))}>
                {t.symptoms[s]}
              </Chip>
            ))}
          </ChipGroup>
          <DayCheckIn day={day} />
        </>
      )}
    </Panel>
  );
}

// Umore, energia, fame e sonno hanno una sola fonte, il check-in del Diario:
// qui si leggono soltanto (si cambiano nel Diario).
function DayCheckIn({ day }: { day: string }) {
  const { locale, dict } = useI18n();
  const t = dict.journal.checkIn;
  const entry = checkIns.use().find((c) => c.day === day);
  if (!entry) return null;
  const parts = [
    ...SCALES.filter((s) => entry[s] !== undefined).map((s) => `${t.scales[s]}: ${t.levels[s][entry[s] as Level]}`),
    ...(entry.sleepHours !== undefined ? [`${t.sleep}: ${formatHours(locale, entry.sleepHours)}`] : []),
  ];
  return (
    <Link href="/journal" className="card block px-4 py-3">
      <span className="eyebrow mb-1 block">{dict.journal.fromCheckIn}</span>
      <span className="block text-subhead text-ink-2">{parts.join(" · ")}</span>
    </Link>
  );
}

function RemoveAll() {
  const { dict } = useI18n();
  const t = dict.health.cycle.remove;
  const [confirming, setConfirming] = useState(false);

  return (
    <Panel>
      <p className="text-footnote text-muted">{t.text}</p>
      {confirming ? (
        <div className="mt-3 flex gap-3">
          <button type="button" className="btn btn-ghost flex-1" onClick={() => setConfirming(false)}>
            {dict.common.cancel}
          </button>
          <button type="button" className="btn btn-danger flex-1" onClick={deleteCycleData}>
            {t.confirm}
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn-danger mt-3" onClick={() => setConfirming(true)}>
          {t.button}
        </button>
      )}
    </Panel>
  );
}
