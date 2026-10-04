"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useI18n } from "@/i18n/client";

export function GameHeader({
  title,
  children,
  closeHref = "/mind",
  closeLabel,
}: {
  title: string;
  children?: ReactNode;
  /** Dove porta la X (di default torna a Mente). */
  closeHref?: string;
  closeLabel?: string;
}) {
  const { dict } = useI18n();
  return (
    <header className="mb-4 flex items-center gap-3">
      <Link
        href={closeHref}
        aria-label={closeLabel ?? dict.mind.closeLabel}
        className="glass-clear grid size-11 shrink-0 place-items-center rounded-full text-ink-2 hover:text-ink"
      >
        <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </Link>
      <h1 className="on-backdrop flex-1 truncate text-headline font-semibold">{title}</h1>
      {children}
    </header>
  );
}
