"use client";

import Link from "next/link";
import { IconTrash } from "@/components/icons";
import { useI18n } from "@/i18n/client";
import { interpolate } from "@/i18n/format";
import type { DailyTargets } from "@/lib/health/energy";

/** "Aggiungi peso e altezza nelle Impostazioni…", con il link. */
export function ProfileMissing({ missing }: { missing: DailyTargets["missing"] }) {
  const { locale, dict } = useI18n();
  if (missing.length === 0) return null;
  const what = new Intl.ListFormat(locale, { type: "conjunction" }).format(missing.map((m) => dict.health.missing[m]));
  return (
    <p className="mt-3 text-footnote text-muted">
      {interpolate(dict.health.profileMissing, { what })}{" "}
      <Link href="/settings#profile" className="link">
        {dict.common.openSettings}
      </Link>
    </p>
  );
}

export function DeleteButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-11 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-[var(--control-bg)] hover:text-error"
    >
      <IconTrash width={18} height={18} />
    </button>
  );
}

/** Data breve leggibile ("4 ott") da AAAA-MM-GG. */
export function useShortDate() {
  const { locale } = useI18n();
  const format = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  return (day: string) => {
    const [y, m, d] = day.split("-").map(Number);
    return format.format(new Date(y, m - 1, d));
  };
}

/** Converte il testo di un campo numerico (accetta anche la virgola). NaN se vuoto. */
export function parseDecimal(text: string): number {
  const clean = text.trim().replace(",", ".");
  return clean === "" ? NaN : Number(clean);
}
