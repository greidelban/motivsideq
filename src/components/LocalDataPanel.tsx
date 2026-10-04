"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { formatBytes, interpolate } from "@/i18n/format";
import { brainResults } from "@/lib/brain/store";
import { LOCAL_QUOTA_BYTES, localUsage, nearlyFull } from "@/lib/storage/quota";

export function LocalDataPanel() {
  const { locale, dict } = useI18n();
  const t = dict.settings.data;
  const results = brainResults.use();
  const [used, setUsed] = useState<number | null>(null);
  useEffect(() => {
    void localUsage().then(setUsed);
  }, [results.length]);
  const [confirming, setConfirming] = useState(false);

  return (
    <Panel>
      <h2 className="mb-2 text-headline font-semibold">{t.title}</h2>
      <p className="text-subhead text-ink-2">{t.body}</p>
      {used !== null && (
        <div className="mt-3">
          <p className="text-footnote text-muted">
            {interpolate(t.storage, { used: formatBytes(locale, used), total: formatBytes(locale, LOCAL_QUOTA_BYTES) })}
          </p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
            <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${Math.min(100, Math.max(1, (used / LOCAL_QUOTA_BYTES) * 100))}%` }} />
          </div>
          {nearlyFull(used) && <p className="mt-2 text-footnote text-warning">{t.storageFull}</p>}
        </div>
      )}
      <p className="mt-3 text-subhead text-muted">
        {t.savedResults} <span className="num text-ink">{results.length}</span>
      </p>
      {results.length > 0 &&
        (confirming ? (
          <div className="mt-4 flex gap-3">
            <button type="button" className="btn btn-ghost flex-1" onClick={() => setConfirming(false)}>
              {dict.common.cancel}
            </button>
            <button
              type="button"
              className="btn btn-danger flex-1"
              onClick={() => {
                brainResults.clear();
                setConfirming(false);
              }}
            >
              {t.confirm}
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-danger mt-4" onClick={() => setConfirming(true)}>
            {t.clear}
          </button>
        ))}
    </Panel>
  );
}
