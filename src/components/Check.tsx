"use client";

import { useId } from "react";

// Casella di spunta con etichetta cliccabile (area di tocco di almeno 44 px).
export function Check({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className={`flex min-h-11 items-center gap-3 text-subhead ${disabled ? "text-muted" : ""}`}>
      <input
        id={id}
        type="checkbox"
        className="size-5 shrink-0 accent-[var(--primary)]"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
