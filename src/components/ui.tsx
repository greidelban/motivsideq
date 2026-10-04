import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

// Componenti di base condivisi (server-safe, nessuno stato).

export function PageHeader({
  title,
  eyebrow,
  action,
  back,
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  /** Tasto per tornare indietro (es. dalle Impostazioni a Oggi). */
  back?: { href: string; label: string };
}) {
  return (
    <header className="flex items-end justify-between gap-4 pt-2 pb-5">
      {back && (
        <Link
          href={back.href}
          aria-label={back.label}
          className="glass-clear mb-0.5 grid size-11 shrink-0 place-items-center rounded-full text-ink-2 hover:text-ink"
        >
          <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
      )}
      <div className="min-w-0 flex-1">
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h1 className="text-title1 font-bold">{title}</h1>
      </div>
      {action}
    </header>
  );
}

export function Panel({ className = "", ...props }: ComponentProps<"section">) {
  return <section className={`glass-elevated rounded-xl p-5 ${className}`} {...props} />;
}

type FieldProps = ComponentProps<"input"> & {
  label: string;
  name: string;
  error?: string[];
  hint?: string;
};

export function Field({ label, name, error, hint, id, ...input }: FieldProps) {
  const fieldId = id ?? `f-${name}`;
  const describedBy = [error?.length ? `${fieldId}-err` : null, hint ? `${fieldId}-hint` : null]
    .filter(Boolean)
    .join(" ");
  return (
    <div>
      <label htmlFor={fieldId} className="label">
        {label}
      </label>
      <input
        id={fieldId}
        name={name}
        className="field"
        aria-invalid={error?.length ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...input}
      />
      {hint && (
        <p id={`${fieldId}-hint`} className="mt-1.5 text-footnote text-muted">
          {hint}
        </p>
      )}
      {error?.length ? (
        <p id={`${fieldId}-err`} className="mt-1.5 text-footnote text-error">
          {error[0]}
        </p>
      ) : null}
    </div>
  );
}

export function FormMessage({ tone, children }: { tone: "error" | "success" | "info"; children: ReactNode }) {
  const color = tone === "error" ? "text-error" : tone === "success" ? "text-success" : "text-ink-2";
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`card px-4 py-3 text-subhead ${color}`}>
      {children}
    </p>
  );
}
