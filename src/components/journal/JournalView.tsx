"use client";

import { useEffect, useRef, useState } from "react";
import { IconChevronLeft, IconChevronRight } from "@/components/icons";
import { Panel } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { formatHours, formatNumber, interpolate } from "@/i18n/format";
import { firstDayOfWeek } from "@/i18n/week";
import { addDays, localDateKey } from "@/lib/dates";
import {
  JOURNAL_TEXT_MAX,
  type Level,
  SCALES,
  SLEEP_RANGE,
  type Scale,
  excerpt,
  isPromptKey,
  nearestLevel,
  promptFor,
  searchPages,
  setCheckIn,
  setPageText,
  stepSleep,
  summarize,
  weekDays,
} from "@/lib/journal/journal";
import { checkIns, deleteJournalData, journalPages } from "@/lib/journal/store";
import { pulseLight } from "@/lib/light/bus";
import { useLocalData } from "@/lib/storage/db";
import { MoodFace, ScaleField } from "./CheckInFields";

// Diario: una settimana da scorrere, il check-in e la pagina del giorno scelto,
// il riepilogo degli ultimi 7 giorni e la ricerca nelle pagine. Tutto resta sul
// dispositivo (nel cloud solo cifrato, con l'abbonamento).

export function JournalView() {
  const ready = useLocalData();
  if (!ready) return <div className="min-h-96" />;
  return <Journal />;
}

const parse = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
};

function useLongDate() {
  const { locale } = useI18n();
  const format = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" });
  return (day: string) => format.format(parse(day));
}

function Journal() {
  const today = localDateKey();
  const [selected, setSelected] = useState(today);
  const topRef = useRef<HTMLDivElement>(null);

  // Aprendo una pagina dall'elenco in fondo si torna su, alla settimana.
  function open(day: string) {
    setSelected(day);
    requestAnimationFrame(() => {
      const el = topRef.current;
      if (!el || el.getBoundingClientRect().top >= 0) return;
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
    });
  }

  return (
    <div ref={topRef} className="scroll-mt-6 space-y-3">
      <WeekStrip selected={selected} today={today} onSelect={setSelected} />
      <CheckInPanel day={selected} today={today} />
      {selected <= today && <PagePanel key={selected} day={selected} />}
      <SummaryPanel today={today} onSelect={open} />
      <ArchivePanel onOpen={open} />
      <RemoveAll />
    </div>
  );
}

function WeekStrip({ selected, today, onSelect }: { selected: string; today: string; onSelect: (day: string) => void }) {
  const { locale, dict } = useI18n();
  const t = dict.journal;
  const longDate = useLongDate();
  const days = weekDays(selected, firstDayOfWeek(locale));
  const moods = new Map(checkIns.use().map((c) => [c.day, c.mood]));
  const written = new Set(journalPages.use().map((p) => p.day));
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "narrow" });
  const atThisWeek = days.includes(today);

  return (
    <Panel>
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          aria-label={t.week.prev}
          onClick={() => onSelect(addDays(selected, -7))}
          className="grid size-11 place-items-center rounded-full text-ink-2 hover:bg-[var(--control-bg)]"
        >
          <IconChevronLeft width={20} height={20} />
        </button>
        <h2 className="flex-1 text-center text-headline font-semibold first-letter:uppercase" aria-live="polite">
          {selected === today ? dict.nav.today : longDate(selected)}
        </h2>
        <button
          type="button"
          aria-label={t.week.next}
          disabled={atThisWeek}
          onClick={() => {
            const next = addDays(selected, 7);
            onSelect(next > today ? today : next);
          }}
          className="grid size-11 place-items-center rounded-full text-ink-2 hover:bg-[var(--control-bg)] disabled:opacity-30"
        >
          <IconChevronRight width={20} height={20} />
        </button>
      </div>

      <div role="group" aria-label={t.week.label} className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const mood = moods.get(day) as Level | undefined;
          const isSelected = day === selected;
          const future = day > today;
          const states = [day === today && dict.nav.today, mood && t.checkIn.levels.mood[mood], written.has(day) && t.week.written];
          return (
            <button
              key={day}
              type="button"
              disabled={future}
              aria-pressed={isSelected}
              aria-label={[longDate(day), ...states.filter(Boolean)].join(", ")}
              onClick={() => onSelect(day)}
              className={`flex min-h-11 flex-col items-center gap-0.5 rounded-2xl py-1.5 transition-colors duration-150 disabled:opacity-35 ${
                isSelected ? "text-ink" : "text-ink-2 hover:bg-[var(--control-bg)]"
              } ${day === today ? "ring-1 ring-[var(--text)]" : ""}`}
              style={isSelected ? { background: "var(--glass-lens)", boxShadow: "var(--glass-lens-edge)" } : undefined}
            >
              <span className="text-caption2 text-muted" aria-hidden="true">
                {weekday.format(parse(day))}
              </span>
              <span className="num text-subhead font-semibold" aria-hidden="true">
                {formatNumber(locale, Number(day.slice(8)))}
              </span>
              <span className="grid h-4 place-items-center text-secondary" aria-hidden="true">
                {mood ? <MoodFace level={mood} size={16} /> : written.has(day) ? <span className="size-1 rounded-full bg-current" /> : null}
              </span>
            </button>
          );
        })}
      </div>

      {selected !== today && (
        <button type="button" className="link mt-2 min-h-11 text-subhead" onClick={() => onSelect(today)}>
          {t.backToToday}
        </button>
      )}
    </Panel>
  );
}

function CheckInPanel({ day, today }: { day: string; today: string }) {
  const { dict } = useI18n();
  const t = dict.journal.checkIn;
  const entry = checkIns.use().find((c) => c.day === day);

  function setScale(scale: Scale, value: Level | undefined) {
    checkIns.set((prev) => setCheckIn(prev, day, { [scale]: value }));
    if (value !== undefined && scale === "mood") pulseLight(0.2);
  }

  return (
    <Panel className="space-y-4">
      <div>
        <h2 className="text-headline font-semibold">{t.title}</h2>
        <p className="mt-1 text-footnote text-muted">{day > today ? t.future : t.hint}</p>
      </div>
      {day <= today && (
        <>
          {SCALES.map((scale) => (
            <ScaleField key={scale} scale={scale} value={entry?.[scale] as Level | undefined} onChange={(v) => setScale(scale, v)} />
          ))}
          <SleepField
            value={entry?.sleepHours}
            onChange={(sleepHours) => checkIns.set((prev) => setCheckIn(prev, day, { sleepHours }))}
          />
        </>
      )}
    </Panel>
  );
}

function SleepField({ value, onChange }: { value: number | undefined; onChange: (value: number | undefined) => void }) {
  const { locale, dict } = useI18n();
  const t = dict.journal.checkIn;
  const stepButton = "grid size-11 shrink-0 place-items-center rounded-full text-title3 text-ink-2 hover:bg-[var(--control-bg)] disabled:opacity-30";
  return (
    <fieldset>
      <legend className="label">{t.sleep}</legend>
      <div className="card flex items-center gap-1 rounded-full p-1">
        <button type="button" aria-label={t.less} disabled={value === SLEEP_RANGE.min} onClick={() => onChange(stepSleep(value, -1))} className={stepButton}>
          <span aria-hidden="true">−</span>
        </button>
        <output className="flex-1 text-center text-headline font-semibold" aria-live="polite">
          {value === undefined ? <span className="font-normal text-muted">{t.notSet}</span> : <span className="num">{formatHours(locale, value)}</span>}
        </output>
        <button type="button" aria-label={t.more} disabled={value === SLEEP_RANGE.max} onClick={() => onChange(stepSleep(value, 1))} className={stepButton}>
          <span aria-hidden="true">+</span>
        </button>
      </div>
      <div className="mt-1.5 flex min-h-11 items-center justify-between gap-3">
        <p className="text-footnote text-muted">{t.sleepHint}</p>
        {value !== undefined && (
          <button type="button" className="link min-h-11 text-footnote" onClick={() => onChange(undefined)}>
            {t.clear}
          </button>
        )}
      </div>
    </fieldset>
  );
}

const SAVE_DELAY_MS = 500;

// La pagina si salva da sola mentre si scrive (dopo una breve pausa, e quando si
// esce dal campo o si cambia giorno). Se arriva una versione nuova (altro
// dispositivo, altra scheda) la si mostra solo quando non si sta scrivendo.
function PagePanel({ day }: { day: string }) {
  const { locale, dict } = useI18n();
  const t = dict.journal.page;
  const page = journalPages.use().find((p) => p.day === day);
  const [text, setText] = useState(page?.text ?? "");
  const [skip, setSkip] = useState(0);
  const [saved, setSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const pending = useRef<{ text: string; promptKey: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const focused = useRef(false);

  const promptKey = isPromptKey(page?.promptKey) ? page.promptKey : promptFor(day, skip);

  function flush() {
    clearTimeout(timer.current);
    const next = pending.current;
    if (!next) return;
    pending.current = null;
    journalPages.set((prev) => setPageText(prev, day, next.text, next.promptKey));
    setSaved(next.text.trim() !== "");
  }

  function change(value: string) {
    setText(value);
    setSaved(false);
    pending.current = { text: value, promptKey };
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY_MS);
  }

  // Cambiando giorno (o pagina) si salva ciò che manca.
  useEffect(() => () => flush(), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!focused.current && !pending.current) setText(page?.text ?? "");
  }, [page?.text]);

  const nearLimit = text.length > JOURNAL_TEXT_MAX * 0.9;

  return (
    <Panel className="space-y-3">
      <h2 className="text-headline font-semibold">{t.title}</h2>
      <div className="card px-4 py-3">
        <p className="eyebrow mb-1">{t.prompt}</p>
        <p className="text-subhead text-ink">{dict.journal.prompts[promptKey]}</p>
        {text.trim() === "" && !page && (
          <button type="button" className="link mt-1 min-h-11 text-footnote" onClick={() => setSkip((s) => s + 1)}>
            {t.anotherPrompt}
          </button>
        )}
      </div>
      <label htmlFor={`journal-${day}`} className="sr-only">
        {t.label}
      </label>
      <textarea
        id={`journal-${day}`}
        value={text}
        maxLength={JOURNAL_TEXT_MAX}
        rows={8}
        placeholder={t.placeholder}
        onChange={(e) => change(e.target.value)}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false;
          flush();
        }}
        className="field min-h-48 resize-y leading-relaxed"
      />
      <div className="flex min-h-5 flex-wrap items-center justify-between gap-x-3 text-footnote text-muted">
        <span>{saved ? t.saved : ""}</span>
        {nearLimit && (
          <span className="num">{interpolate(t.length, { n: formatNumber(locale, text.length), max: formatNumber(locale, JOURNAL_TEXT_MAX) })}</span>
        )}
      </div>
      {page &&
        (confirming ? (
          <div className="flex gap-3">
            <button type="button" className="btn btn-ghost flex-1" onClick={() => setConfirming(false)}>
              {dict.common.cancel}
            </button>
            <button
              type="button"
              className="btn btn-danger flex-1"
              onClick={() => {
                clearTimeout(timer.current);
                pending.current = null;
                journalPages.set((prev) => prev.filter((p) => p.day !== day));
                setText("");
                setSaved(false);
                setConfirming(false);
              }}
            >
              {t.confirmDelete}
            </button>
          </div>
        ) : (
          <button type="button" className="link min-h-11 text-footnote" onClick={() => setConfirming(true)}>
            {t.delete}
          </button>
        ))}
    </Panel>
  );
}

function SummaryPanel({ today, onSelect }: { today: string; onSelect: (day: string) => void }) {
  const { locale, dict } = useI18n();
  const t = dict.journal.summary;
  const levels = dict.journal.checkIn.levels;
  const list = checkIns.use();
  const s = summarize(list, today);
  if (s.checkIns === 0) return null;

  const byDay = new Map(list.map((c) => [c.day, c.mood]));
  const last = Array.from({ length: s.days }, (_, i) => addDays(today, i - (s.days - 1)));
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "narrow" });
  const longDate = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" });
  const stats = [
    { label: t.mood, value: s.mood === null ? null : levels.mood[nearestLevel(s.mood)] },
    { label: t.energy, value: s.energy === null ? null : levels.energy[nearestLevel(s.energy)] },
    { label: t.sleep, value: s.sleepHours === null ? null : formatHours(locale, s.sleepHours) },
    { label: t.checkIns, value: interpolate(t.checkInsValue, { n: formatNumber(locale, s.checkIns), days: formatNumber(locale, s.days) }) },
  ];

  return (
    <Panel>
      <h2 className="mb-3 text-headline font-semibold">{t.title}</h2>
      <div className="grid grid-cols-2 gap-2 text-center">
        {stats.map(({ label, value }) => (
          <div key={label} className="card px-2 py-3">
            <p className={`text-headline font-semibold ${value === null ? "text-muted" : ""}`}>{value ?? t.empty}</p>
            <p className="text-caption text-muted">{label}</p>
          </div>
        ))}
      </div>
      <h3 className="label mt-4">{t.byDay}</h3>
      <ul className="grid grid-cols-7 gap-1 text-center">
        {last.map((day) => {
          const mood = byDay.get(day) as Level | undefined;
          return (
            <li key={day}>
              <button
                type="button"
                onClick={() => onSelect(day)}
                aria-label={`${longDate.format(parse(day))}: ${mood ? levels.mood[mood] : t.empty}`}
                className="flex min-h-11 w-full flex-col items-center gap-1 rounded-2xl py-1.5 hover:bg-[var(--control-bg)]"
              >
                <span className={mood ? "text-secondary" : "text-muted opacity-40"} aria-hidden="true">
                  <MoodFace level={mood ?? 3} size={22} />
                </span>
                <span className="text-caption2 text-muted" aria-hidden="true">
                  {weekday.format(parse(day))}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

const ARCHIVE_PAGE = 20;

function ArchivePanel({ onOpen }: { onOpen: (day: string) => void }) {
  const { locale, dict } = useI18n();
  const t = dict.journal.archive;
  const pages = journalPages.use();
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(ARCHIVE_PAGE);
  if (pages.length === 0) return null;

  const results = searchPages(pages, query);
  const date = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "long", year: "numeric" });

  return (
    <Panel>
      <h2 className="mb-3 text-headline font-semibold">{t.title}</h2>
      <label htmlFor="journal-search" className="sr-only">
        {t.search}
      </label>
      <input
        id="journal-search"
        type="search"
        className="field"
        placeholder={t.search}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setShown(ARCHIVE_PAGE);
        }}
      />
      {results.length === 0 ? (
        <p className="mt-3 text-subhead text-muted" role="status">
          {interpolate(t.noResults, { query: query.trim() })}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {results.slice(0, shown).map((p) => {
            const part = excerpt(p.text, query);
            return (
              <li key={p.day}>
                <button type="button" onClick={() => onOpen(p.day)} className="card block w-full px-4 py-3 text-start">
                  <span className="block text-footnote font-semibold text-ink-2 first-letter:uppercase">{date.format(parse(p.day))}</span>
                  <span className="mt-0.5 line-clamp-3 block text-subhead text-ink">
                    {part.before && "…"}
                    {part.text}
                    {part.after && "…"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {results.length > shown && (
        <button type="button" className="btn btn-ghost mt-3 w-full" onClick={() => setShown((n) => n + ARCHIVE_PAGE)}>
          {t.more}
        </button>
      )}
    </Panel>
  );
}

function RemoveAll() {
  const { dict } = useI18n();
  const t = dict.journal.remove;
  const [confirming, setConfirming] = useState(false);
  const checks = checkIns.use();
  const pages = journalPages.use();
  if (checks.length === 0 && pages.length === 0) return null;

  return (
    <Panel>
      <p className="text-footnote text-muted">{t.text}</p>
      {confirming ? (
        <div className="mt-3 flex gap-3">
          <button type="button" className="btn btn-ghost flex-1" onClick={() => setConfirming(false)}>
            {dict.common.cancel}
          </button>
          <button
            type="button"
            className="btn btn-danger flex-1"
            onClick={() => {
              deleteJournalData();
              setConfirming(false);
            }}
          >
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
