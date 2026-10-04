"use client";

// Controllo a segmenti: l'opzione scelta usa la "lente" di vetro di Liquid Atlas.
export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="card flex gap-1 rounded-full p-1">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={String(o.value)}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(o.value)}
              className={`min-h-11 flex-1 rounded-full text-subhead font-semibold transition-colors duration-150 ${
                active ? "text-ink" : "text-muted hover:text-ink-2"
              }`}
              style={active ? { background: "var(--glass-lens)", boxShadow: "var(--glass-lens-edge)" } : undefined}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
