"use client";

import { useEffect, useId, useState } from "react";
import { Segmented } from "@/components/brain/Segmented";
import { Check } from "@/components/Check";
import { Notice } from "@/components/health/Chip";
import { Panel } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { interpolate } from "@/i18n/format";
import { APP_NAME } from "@/lib/app";
import { localDateKey } from "@/lib/dates";
import { INTENSITIES } from "@/lib/quotes/categories";
import { type NotificationStatus, notificationStatus, requestNotifications } from "@/lib/notifications";
import { quoteFor } from "@/lib/quotes/pick";
import {
  inQuietHours,
  isPaused,
  MAX_TIMES_PER_DAY,
  type QuotePreferences,
  SPONSOR_CONSENT_VERSION,
  sponsoredAllowed,
} from "@/lib/quotes/preferences";
import { sponsorConfig } from "@/lib/quotes/sponsor-config";
import { refreshSponsorFeed } from "@/lib/quotes/sponsor-feed";
import { quotePrefs, sponsorFeedCache } from "@/lib/quotes/store";
import { useQuoteTexts } from "@/lib/quotes/use-quote-texts";
import { useHydrated } from "@/lib/storage/local-store";
import { useNow } from "@/lib/use-now";

const HOUR = 60 * 60 * 1000;
const PAUSES = [
  { key: "day", ms: 24 * HOUR },
  { key: "threeDays", ms: 3 * 24 * HOUR },
  { key: "week", ms: 7 * 24 * HOUR },
] as const;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
// Gli sponsor esistono solo se la versione dell'app ha indirizzo e chiave del file firmato.
const sponsorsConfigured = sponsorConfig() !== null;

function update(patch: (p: QuotePreferences) => Partial<QuotePreferences>) {
  quotePrefs.set((p) => ({ ...p, ...patch(p) }));
}

function TimeInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = useId();
  return (
    <div className="min-w-0 flex-1">
      <label htmlFor={id} className="label">
        {label}
      </label>
      <input
        id={id}
        type="time"
        className="field"
        value={value}
        onChange={(e) => {
          if (TIME.test(e.target.value)) onChange(e.target.value);
        }}
      />
    </div>
  );
}

export function QuoteSettings() {
  const { locale, dict } = useI18n();
  const t = dict.quotes.settings;
  const prefs = quotePrefs.use();
  const hydrated = useHydrated();
  const now = useNow();
  const [status, setStatus] = useState<NotificationStatus | null>(null);
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    notificationStatus().then((s) => {
      if (!cancelled) setStatus(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const dateTime = (ms: number) =>
    new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(ms);
  const texts = useQuoteTexts(locale);
  const example = hydrated && now && texts ? texts[quoteFor(localDateKey(now), prefs.intensity).id] : null;
  const paused = now !== null && isPaused(prefs, now.getTime());
  const sponsorsOn = sponsoredAllowed(prefs);

  async function setNotify(on: boolean) {
    if (!on) return update(() => ({ notify: false }));
    const next = status === "granted" ? "granted" : await requestNotifications();
    setStatus(next);
    if (next === "granted") update(() => ({ notify: true }));
  }

  function setTime(index: number, value: string) {
    update((p) => ({ times: p.times.map((time, i) => (i === index ? value : time)) }));
  }

  function enableSponsors() {
    update(() => ({ sponsored: { optIn: true, consentAt: Date.now(), consentVersion: SPONSOR_CONSENT_VERSION } }));
    setConsent(false);
    refreshSponsorFeed();
  }

  function disableSponsors() {
    update(() => ({ sponsored: { optIn: false, consentAt: null, consentVersion: null } }));
    // Il file scaricato non serve più: si toglie dal dispositivo.
    sponsorFeedCache.clear();
  }

  return (
    <div className="space-y-4">
      <Panel>
        <h2 className="mb-1 text-headline font-semibold">{t.intensity.title}</h2>
        <p className="mb-3 text-footnote text-muted">{t.intensity.hint}</p>
        <Segmented
          label={t.intensity.title}
          labelHidden
          options={INTENSITIES.map((value) => ({ value, label: dict.quotes.intensity[value] }))}
          value={prefs.intensity}
          onChange={(intensity) => update(() => ({ intensity }))}
        />
        <div className="card mt-3 rounded-lg px-4 py-3">
          <p className="text-footnote text-muted">{t.intensity.example}</p>
          <p className="mt-1 min-h-[2.75rem] text-callout">{example}</p>
        </div>
      </Panel>

      <Panel>
        <h2 className="mb-2 text-headline font-semibold">{t.notifications.title}</h2>
        <Check
          label={t.notifications.enable}
          checked={prefs.notify && status === "granted"}
          disabled={status === null || status === "unavailable"}
          onChange={setNotify}
        />
        {status === "unavailable" && <p className="mt-1 text-footnote text-muted">{t.notifications.unavailable}</p>}
        {status === "denied" && <Notice tone="warning">{interpolate(t.notifications.denied, { app: APP_NAME })}</Notice>}
        <p className="mt-2 text-footnote text-muted">{t.notifications.privacy}</p>

        <fieldset className="mt-4">
          <legend className="label">{t.notifications.times}</legend>
          <ul className="space-y-3">
            {prefs.times.map((time, i) => (
              <li key={i}>
                <div className="flex items-end gap-2">
                  <TimeInput label={interpolate(t.notifications.time, { n: i + 1 })} value={time} onChange={(v) => setTime(i, v)} />
                  {prefs.times.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-ghost shrink-0"
                      aria-label={interpolate(t.notifications.remove, { n: i + 1 })}
                      onClick={() => update((p) => ({ times: p.times.filter((_, j) => j !== i) }))}
                    >
                      <span aria-hidden="true">✕</span>
                    </button>
                  )}
                </div>
                {inQuietHours(time, prefs.quiet) && <Notice tone="warning">{t.notifications.inQuiet}</Notice>}
              </li>
            ))}
          </ul>
          {prefs.times.length < MAX_TIMES_PER_DAY && (
            <button
              type="button"
              className="btn btn-ghost mt-3"
              onClick={() => update((p) => ({ times: [...p.times, p.times.includes("18:00") ? "12:00" : "18:00"] }))}
            >
              {t.notifications.add}
            </button>
          )}
        </fieldset>
      </Panel>

      <Panel>
        <h2 className="mb-2 text-headline font-semibold">{t.quiet.title}</h2>
        <Check
          label={t.quiet.enable}
          checked={prefs.quiet.enabled}
          onChange={(enabled) => update((p) => ({ quiet: { ...p.quiet, enabled } }))}
        />
        {prefs.quiet.enabled && (
          <div className="mt-2 flex gap-3">
            <TimeInput label={t.quiet.from} value={prefs.quiet.start} onChange={(start) => update((p) => ({ quiet: { ...p.quiet, start } }))} />
            <TimeInput label={t.quiet.to} value={prefs.quiet.end} onChange={(end) => update((p) => ({ quiet: { ...p.quiet, end } }))} />
          </div>
        )}
      </Panel>

      <Panel>
        <h2 className="mb-1 text-headline font-semibold">{t.pause.title}</h2>
        <p className="mb-3 text-footnote text-muted">{t.pause.hint}</p>
        {paused && prefs.pausedUntil !== null ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-subhead text-ink-2" role="status">
              {interpolate(t.pause.until, { date: dateTime(prefs.pausedUntil) })}
            </p>
            <button type="button" className="btn btn-ghost" onClick={() => update(() => ({ pausedUntil: null }))}>
              {t.pause.resume}
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {PAUSES.map(({ key, ms }) => (
              <button key={key} type="button" className="btn btn-ghost" onClick={() => update(() => ({ pausedUntil: Date.now() + ms }))}>
                {t.pause[key]}
              </button>
            ))}
          </div>
        )}
      </Panel>

      {sponsorsConfigured && (
        <Panel id="sponsored" className="scroll-mt-6">
          <h2 className="mb-2 text-headline font-semibold">{t.sponsored.title}</h2>
          <p className="text-subhead text-ink-2">{t.sponsored.intro}</p>
          <ul className="mt-3 space-y-2 text-footnote text-ink-2">
            {[t.sponsored.rules.frequency, t.sponsored.rules.label, t.sponsored.rules.privacy, t.sponsored.rules.topics].map((rule) => (
              <li key={rule} className="flex gap-2.5">
                <span className="text-secondary" aria-hidden="true">
                  ●
                </span>
                {rule}
              </li>
            ))}
          </ul>
          {sponsorsOn && prefs.sponsored.consentAt !== null ? (
            <div className="mt-4 space-y-3">
              <p className="text-subhead text-ink-2" role="status">
                {interpolate(t.sponsored.onSince, { date: dateTime(prefs.sponsored.consentAt) })}
              </p>
              <button type="button" className="btn btn-ghost w-full" onClick={disableSponsors}>
                {t.sponsored.disable}
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {/* Consenso esplicito: la casella parte sempre vuota. */}
              <Check label={t.sponsored.consent} checked={consent} onChange={setConsent} />
              <button type="button" className="btn btn-primary w-full" disabled={!consent} onClick={enableSponsors}>
                {t.sponsored.enable}
              </button>
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
