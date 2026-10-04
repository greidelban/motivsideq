"use client";

import { type FormEvent, useState } from "react";
import { Field, FormMessage, Panel } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { interpolate, plural } from "@/i18n/format";
import {
  type PendingCode,
  adoptLocalData,
  prepareNewCode,
  prepareVault,
  requestSync,
  resetVault,
  unlockVault,
  useSyncStatus,
} from "@/lib/sync/run";

// Il cloud cifrato nella pagina Account: abbonamento, attivazione con il codice
// di recupero, sblocco su un nuovo dispositivo, stato della sincronizzazione.

export function VaultPanel() {
  const { dict } = useI18n();
  const t = dict.settings.account;
  const s = useSyncStatus();

  return (
    <Panel>
      <h2 className="mb-2 text-headline font-semibold">{t.sync.title}</h2>
      {s.vault === null && (
        <p className="text-subhead text-muted">{s.outcome && s.outcome !== "synced" ? t.sync[s.outcome] : t.working}</p>
      )}
      {s.vault === "free" && <p className="text-subhead text-ink-2">{t.vault.free}</p>}
      {s.vault === "setup" && <Setup />}
      {s.vault === "locked" && <Unlock />}
      {s.vault === "ready" && <Ready />}
    </Panel>
  );
}

/** Mostra il codice e lo rende valido solo dopo la conferma dell'utente. */
function CodeStep({ pending, onDone }: { pending: PendingCode; onDone: (result: "ok" | "exists") => void }) {
  const { dict } = useI18n();
  const t = dict.settings.account.vault;
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <div className="space-y-4">
      <h3 className="text-subhead font-semibold">{t.codeTitle}</h3>
      <p className="text-subhead text-ink-2">{t.codeIntro}</p>
      <p className="card num px-4 py-3 text-center text-body font-semibold tracking-wide break-all select-all" aria-label={t.codeLabel}>
        {pending.code}
      </p>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(pending.code);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? t.copied : t.copy}
      </button>
      <label className="flex min-h-11 items-center gap-3 text-subhead">
        <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        {t.saved}
      </label>
      {failed && <FormMessage tone="error">{dict.settings.account.errors.generic}</FormMessage>}
      <button
        type="button"
        className="btn btn-primary w-full"
        disabled={!saved || busy}
        onClick={async () => {
          setBusy(true);
          setFailed(false);
          try {
            onDone(await pending.confirm());
          } catch {
            setFailed(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? dict.settings.account.working : t.continue}
      </button>
    </div>
  );
}

function Setup() {
  const { dict } = useI18n();
  const t = dict.settings.account.vault;
  const [pending, setPending] = useState<PendingCode | null>(null);

  if (pending) return <CodeStep pending={pending} onDone={() => setPending(null)} />;
  return (
    <div className="space-y-4">
      <p className="text-subhead text-ink-2">{t.setupIntro}</p>
      <button type="button" className="btn btn-primary w-full" onClick={() => setPending(prepareVault())}>
        {t.activate}
      </button>
    </div>
  );
}

function Unlock() {
  const { dict } = useI18n();
  const t = dict.settings.account.vault;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = String(new FormData(e.currentTarget).get("code") ?? "");
    setBusy(true);
    setError(null);
    try {
      const result = await unlockVault(code);
      if (result !== "ok") setError(t[result]);
    } catch {
      setError(dict.settings.account.errors.network);
    } finally {
      setBusy(false);
    }
  }

  if (resetting) {
    return (
      <div className="space-y-4">
        <FormMessage tone="error">{t.resetText}</FormMessage>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await resetVault();
              } catch {
                setError(dict.settings.account.errors.network);
                setResetting(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            {t.resetConfirm}
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setResetting(false)}>
            {dict.common.cancel}
          </button>
        </div>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <p className="text-subhead text-ink-2">{t.lockedIntro}</p>
      <Field
        label={t.codeLabel}
        name="code"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        hint={t.codeHint}
        error={error ? [error] : undefined}
      />
      <button type="submit" className="btn btn-primary w-full" disabled={busy}>
        {busy ? dict.settings.account.working : t.unlock}
      </button>
      <button type="button" className="link flex min-h-11 items-center text-subhead" onClick={() => setResetting(true)}>
        {t.lost}
      </button>
    </form>
  );
}

/** Stato della sincronizzazione, in parole semplici, e nuovo codice di recupero. */
function Ready() {
  const { locale, dict } = useI18n();
  const t = dict.settings.account.sync;
  const v = dict.settings.account.vault;
  const s = useSyncStatus();
  const [pending, setPending] = useState<PendingCode | null>(null);
  const [confirmNew, setConfirmNew] = useState(false);
  const [codeDone, setCodeDone] = useState(false);

  if (pending) {
    return (
      <CodeStep
        pending={pending}
        onDone={() => {
          setPending(null);
          setCodeDone(true);
        }}
      />
    );
  }

  const time = s.lastSyncAt ? new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(new Date(s.lastSyncAt)) : null;
  const problem = s.outcome !== null && s.outcome !== "synced" ? s.outcome : null;
  const message = s.running ? t.running : problem ? t[problem] : time ? interpolate(t.synced, { time }) : t.never;
  const warn = !s.running && problem !== null;

  return (
    <div>
      <p role="status" aria-live="polite" className={`text-subhead ${warn ? "text-warning" : "text-ink-2"}`}>
        {!warn && !s.running && time && (
          <span className="text-success" aria-hidden="true">
            ✓{" "}
          </span>
        )}
        {message}
      </p>
      {s.pending > 0 && <p className="mt-1 text-footnote text-muted">{plural(locale, s.pending, t.pending)}</p>}
      {s.unreadable > 0 && <p className="mt-1 text-footnote text-warning">{plural(locale, s.unreadable, t.unreadable)}</p>}
      {s.fullResync && <p className="mt-2 text-footnote text-ink-2">{t.fullResync}</p>}
      <p className="mt-2 text-footnote text-muted">{t.scope}</p>
      {s.outcome === "otherAccount" ? (
        <button type="button" className="btn btn-primary mt-4 w-full" onClick={adoptLocalData}>
          {t.adopt}
        </button>
      ) : (
        <button type="button" className="btn btn-ghost mt-4" disabled={s.running} onClick={() => void requestSync()}>
          {t.now}
        </button>
      )}

      <div className="mt-6 space-y-3">
        {codeDone && <FormMessage tone="success">{v.newCodeDone}</FormMessage>}
        {confirmNew ? (
          <>
            <p className="text-subhead text-ink-2">{v.newCodeText}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => {
                  setConfirmNew(false);
                  setCodeDone(false);
                  setPending(await prepareNewCode());
                }}
              >
                {v.continue}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmNew(false)}>
                {dict.common.cancel}
              </button>
            </div>
          </>
        ) : (
          <button type="button" className="link flex min-h-11 items-center text-left text-subhead" onClick={() => setConfirmNew(true)}>
            {v.newCode}
          </button>
        )}
      </div>
    </div>
  );
}
