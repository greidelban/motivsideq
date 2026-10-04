"use client";

import Link from "next/link";
import { useState } from "react";
import { Panel } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { interpolate, plural } from "@/i18n/format";
import { addDays, daysBetween, localDateKey } from "@/lib/dates";
import {
  type CycleStatus,
  FLOWS,
  SYMPTOMS,
  cycleStatus,
  endPeriod,
  setFlow,
  sortPeriods,
  startPeriod,
  toggleSymptom,
} from "@/lib/health/cycle";
import { cycleConsent, cycleDayLogs, cyclePeriods, deleteCycleData } from "@/lib/health/store";
import { profileAgeGroup } from "@/lib/profile/profile";
import { profile } from "@/lib/profile/store";
import { useHydrated } from "@/lib/storage/local-store";
import { Chip, ChipGroup, Notice } from "./Chip";
import { DeleteButton, useShortDate } from "./shared";

export function CycleView() {
  const hydrated = useHydrated();
  if (!hydrated) return <div className="min-h-96" />;
  return <Cycle />;
}

// Prima di tutto: età (solo maggiorenni) e consenso. Senza, nessun dato si legge né si scrive.
function Cycle() {
  const { dict } = useI18n();
  const t = dict.health.cycle;
  const group = profileAgeGroup(profile.use());
  const consent = cycleConsent.use();

  if (group === null) {
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
  if (group !== "adult") {
    return (
      <Panel>
        <h2 className="mb-2 text-headline font-semibold">{t.adultsOnly.title}</h2>
        <p className="text-subhead text-ink-2">{t.adultsOnly.text}</p>
      </Panel>
    );
  }
  if (!consent) {
    return (
      <Panel>
        <h2 className="mb-2 text-headline font-semibold">{t.consent.title}</h2>
        <p className="text-subhead text-ink-2">{t.consent.text}</p>
        <p className="mt-3 text-footnote text-muted">{t.consent.method}</p>
        <button type="button" className="btn btn-primary mt-4 w-full" onClick={() => cycleConsent.set({ acceptedAt: new Date().toISOString() })}>
          {t.consent.accept}
        </button>
      </Panel>
    );
  }
  return <Tracker />;
}

function Tracker() {
  const { locale, dict } = useI18n();
  const t = dict.health.cycle;
  const periods = cyclePeriods.use();
  const today = localDateKey();
  const status = cycleStatus(periods, today);
  const shortDate = useShortDate();

  return (
    <>
      {status ? (
        <StatusPanel status={status} />
      ) : (
        <Panel>
          <h2 className="mb-2 text-headline font-semibold">{t.empty.title}</h2>
          <p className="text-subhead text-ink-2">{t.empty.text}</p>
        </Panel>
      )}

      <LogPeriod today={today} />
      {status && <TodayLog today={today} />}

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
                  <li key={p.id} className="card flex items-center gap-3 py-2 pr-1.5 pl-4">
                    <p className="min-w-0 flex-1 text-subhead">
                      {shortDate(p.start)}
                      {p.end && ` – ${shortDate(p.end)}`}
                      {ongoing && <span className="text-muted"> · {t.history.ongoing}</span>}
                    </p>
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

      <RemoveAll />
    </>
  );
}

function StatusPanel({ status }: { status: CycleStatus }) {
  const { locale, dict } = useI18n();
  const t = dict.health.cycle.status;
  const shortDate = useShortDate();
  const next =
    status.daysUntilNext > 0
      ? plural(locale, status.daysUntilNext, t.nextIn)
      : status.daysUntilNext === 0
        ? t.nextToday
        : plural(locale, -status.daysUntilNext, t.late);

  return (
    <Panel>
      <p className="eyebrow mb-1">{interpolate(t.day, { n: status.day })}</p>
      <h2 className="text-title2 font-bold">{t.phases[status.phase]}</h2>
      <p className="mt-1 text-subhead text-ink-2">{t.phaseText[status.phase]}</p>
      <CycleBar status={status} />
      <p className="mt-4 text-headline font-semibold">{next}</p>
      <ul className="mt-1 space-y-0.5 text-footnote text-muted">
        {status.daysUntilNext > 0 && <li>{interpolate(t.nextDate, { date: shortDate(status.nextStart) })}</li>}
        {status.phase !== "late" && status.ovulation >= localDateKey() && (
          <>
            <li>{interpolate(t.fertile, { from: shortDate(status.fertileStart), to: shortDate(status.fertileEnd) })}</li>
            <li>{interpolate(t.ovulation, { date: shortDate(status.ovulation) })}</li>
          </>
        )}
      </ul>
    </Panel>
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

function LogPeriod({ today }: { today: string }) {
  const { dict } = useI18n();
  const t = dict.health.cycle.actions;
  const [day, setDay] = useState(today);
  const [error, setError] = useState<keyof typeof t.errors | null>(null);

  function start() {
    const result = startPeriod(cyclePeriods.get(), day, today, crypto.randomUUID());
    if (!result.ok) return setError(result.reason);
    cyclePeriods.set(result.periods);
    setError(null);
  }

  function end() {
    if (day > today) return setError("future");
    const next = endPeriod(cyclePeriods.get(), day);
    if (!next) return setError("noPeriod");
    cyclePeriods.set(next);
    setError(null);
  }

  return (
    <Panel>
      <label htmlFor="cycle-day" className="label">
        {t.date}
      </label>
      <input
        id="cycle-day"
        type="date"
        className="field"
        value={day}
        max={today}
        min={addDays(today, -730)}
        onChange={(e) => {
          setDay(e.target.value);
          setError(null);
        }}
      />
      <div className="mt-3 grid gap-2">
        <button type="button" className="btn btn-primary" onClick={start}>
          {t.start}
        </button>
        <button type="button" className="btn btn-ghost" onClick={end}>
          {t.end}
        </button>
      </div>
      {error && <Notice tone="error">{t.errors[error]}</Notice>}
    </Panel>
  );
}

function TodayLog({ today }: { today: string }) {
  const { dict } = useI18n();
  const t = dict.health.cycle;
  const log = cycleDayLogs.use().find((l) => l.day === today);

  return (
    <Panel className="space-y-4">
      <h2 className="text-headline font-semibold">{t.today.title}</h2>
      <ChipGroup label={t.today.flow}>
        {FLOWS.map((f) => (
          <Chip key={f} active={log?.flow === f} onClick={() => cycleDayLogs.set((prev) => setFlow(prev, today, log?.flow === f ? undefined : f))}>
            {t.today.flows[f]}
          </Chip>
        ))}
      </ChipGroup>
      <ChipGroup label={t.today.symptoms}>
        {SYMPTOMS.map((s) => (
          <Chip key={s} active={log?.symptoms.includes(s) ?? false} onClick={() => cycleDayLogs.set((prev) => toggleSymptom(prev, today, s))}>
            {t.symptoms[s]}
          </Chip>
        ))}
      </ChipGroup>
    </Panel>
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
