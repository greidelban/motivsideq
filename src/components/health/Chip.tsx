"use client";

import type { ReactNode } from "react";

// Scelta a pastiglia (tipi di allenamento, sintomi, sesso...): quella attiva usa
// la lente di vetro, come Segmented, ma qui le opzioni vanno a capo.
export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-11 min-w-11 rounded-full px-3.5 text-subhead font-medium transition-colors duration-150 ${
        active ? "text-ink" : "card text-muted hover:text-ink-2"
      }`}
      style={active ? { background: "var(--glass-lens)", boxShadow: "var(--glass-lens-edge)" } : undefined}
    >
      {children}
    </button>
  );
}

export function ChipGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

/** Segnalazione breve sotto un modulo (salvato, errore...). */
export function Notice({ tone, children }: { tone: "error" | "success" | "warning"; children: ReactNode }) {
  const color = tone === "error" ? "text-error" : tone === "success" ? "text-success" : "text-warning";
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`mt-3 text-footnote ${color}`}>
      {children}
    </p>
  );
}
