"use client";

import Link from "next/link";
import { IconSettings } from "@/components/icons";
import { PageHeader } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { partOfDay } from "@/lib/dates";
import { useHydrated } from "@/lib/storage/local-store";

// Saluto e data dipendono dall'ora del dispositivo: si calcolano nel browser.
export function TodayHeader() {
  const { locale, dict } = useI18n();
  const hydrated = useHydrated();
  const now = new Date();
  const date = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(now);

  return (
    <PageHeader
      eyebrow={hydrated ? date : " "}
      title={hydrated ? dict.today.greeting[partOfDay(now)] : dict.today.greeting.fallback}
      action={
        <Link
          href="/settings"
          aria-label={dict.common.settings}
          className="glass-clear grid size-11 place-items-center rounded-full text-ink-2 hover:text-ink"
        >
          <IconSettings width={20} height={20} />
        </Link>
      }
    />
  );
}
