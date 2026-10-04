"use client";

import { useRef, useState } from "react";
import { Notice } from "@/components/health/Chip";
import { Panel } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { interpolate, plural } from "@/i18n/format";
import { APP_NAME } from "@/lib/app";
import { localDateKey } from "@/lib/dates";
import { type BackupFile, backupFileName, countItems, parseBackup } from "@/lib/storage/backup";
import { exportData, importData } from "@/lib/storage/backup-stores";
import { useLocalData } from "@/lib/storage/db";

type Status =
  | { kind: "exported"; file: string }
  | { kind: "preview"; file: BackupFile; items: number }
  | { kind: "imported"; items: number; skipped: number }
  | { kind: "error"; reason: "json" | "format" | "read" };

// Export (file JSON) e import dei dati locali: la copia di sicurezza prima di
// cambiare dispositivo, browser o modo di salvare i dati.
export function BackupPanel() {
  const { locale, dict } = useI18n();
  const t = dict.settings.data.backup;
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status | null>(null);
  // Prima del caricamento gli store sono vuoti: esportare ora darebbe un file vuoto.
  const ready = useLocalData();

  function download() {
    const name = backupFileName(localDateKey());
    const blob = new Blob([JSON.stringify(exportData(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    setStatus({ kind: "exported", file: name });
  }

  async function pick(file: File | undefined) {
    if (!file) return;
    let text: string;
    try {
      text = await file.text();
    } catch {
      setStatus({ kind: "error", reason: "read" });
      return;
    }
    const parsed = parseBackup(text);
    setStatus(parsed.ok ? { kind: "preview", file: parsed.file, items: countItems(parsed.file) } : { kind: "error", reason: parsed.reason });
  }

  function confirmImport(file: BackupFile) {
    const plan = importData(file);
    const items = Object.values(plan.counts).reduce((a, b) => a + b, 0);
    setStatus({ kind: "imported", items, skipped: plan.skipped });
  }

  const exportedOn = (iso: string) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));

  return (
    <Panel>
      <h2 className="mb-2 text-headline font-semibold">{t.title}</h2>
      <p className="text-subhead text-ink-2">{t.text}</p>
      <p className="mt-2 text-footnote text-muted">{t.sensitive}</p>

      <div className="mt-4 grid gap-2">
        <button type="button" className="btn btn-primary" disabled={!ready} onClick={download}>
          {t.export}
        </button>
        <button type="button" className="btn btn-ghost" disabled={!ready} onClick={() => input.current?.click()}>
          {t.import}
        </button>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            void pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      {status?.kind === "exported" && <Notice tone="success">{interpolate(t.exported, { file: status.file })}</Notice>}
      {status?.kind === "error" && <Notice tone="error">{interpolate(t.errors[status.reason], { app: APP_NAME })}</Notice>}
      {status?.kind === "imported" && (
        <Notice tone="success">
          {plural(locale, status.items, t.imported)}
          {status.skipped > 0 && <span className="mt-1 block text-warning">{plural(locale, status.skipped, t.skipped)}</span>}
        </Notice>
      )}
      {status?.kind === "preview" && (
        <div className="card mt-4 p-4">
          <p className="text-subhead">{plural(locale, status.items, t.preview, { date: exportedOn(status.file.exportedAt) })}</p>
          <p className="mt-2 text-footnote text-muted">{t.importHint}</p>
          <div className="mt-3 flex gap-3">
            <button type="button" className="btn btn-ghost flex-1" onClick={() => setStatus(null)}>
              {dict.common.cancel}
            </button>
            <button type="button" className="btn btn-primary flex-1" onClick={() => confirmImport(status.file)}>
              {t.confirmImport}
            </button>
          </div>
        </div>
      )}
    </Panel>
  );
}
