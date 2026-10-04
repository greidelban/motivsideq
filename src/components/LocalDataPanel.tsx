"use client";

import { useState } from "react";
import { Panel } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { brainResults } from "@/lib/brain/store";

export function LocalDataPanel() {
  const { dict } = useI18n();
  const t = dict.settings.data;
  const results = brainResults.use();
  const [confirming, setConfirming] = useState(false);

  return (
    <Panel>
      <h2 className="mb-2 text-headline font-semibold">{t.title}</h2>
      <p className="text-subhead text-ink-2">{t.body}</p>
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
