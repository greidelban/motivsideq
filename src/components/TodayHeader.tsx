"use client";

import Link from "next/link";
import { IconChatIncognito, IconLock, IconSettings } from "@/components/icons";
import { PageHeader } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { interpolate } from "@/i18n/format";
import { partOfDay } from "@/lib/dates";
import { LOCAL_USER, can } from "@/lib/entitlements";
import { profile } from "@/lib/profile/store";
import { useNow } from "@/lib/use-now";

const ROUND_BUTTON = "glass-clear grid size-11 place-items-center rounded-full text-ink-2 hover:text-ink";
// Il lucchetto sparirà da solo quando il piano includerà la chat (entitlements.ts).
const chatLocked = !can(LOCAL_USER, "chat");

// Saluto, data e ora dipendono dall'orologio del dispositivo: si calcolano nel
// browser e si aggiornano a ogni minuto. Il nome (facoltativo, dal profilo) lo
// vede solo l'utente: resta sul dispositivo.
export function TodayHeader() {
  const { locale, dict } = useI18n();
  const now = useNow();
  const date = now && new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(now);
  const time = now && new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(now);
  const name = profile.use().displayName;
  const greeting = now ? dict.today.greeting[partOfDay(now)] : dict.today.greeting.fallback;

  return (
    <PageHeader
      eyebrow={now ? interpolate(dict.today.dateTime, { date: date!, time: time! }) : " "}
      title={name ? interpolate(dict.today.greetingWithName, { greeting, name }) : greeting}
      action={
        <div className="flex shrink-0 gap-2">
          <Link href="/chat" aria-label={chatLocked ? dict.chat.openLocked : dict.chat.open} className={`${ROUND_BUTTON} relative`}>
            <IconChatIncognito width={21} height={21} />
            {chatLocked && (
              <span className="absolute -end-0.5 -bottom-0.5 grid size-[18px] place-items-center rounded-full bg-primary text-on-primary">
                <IconLock width={11} height={11} strokeWidth={2.4} />
              </span>
            )}
          </Link>
          <Link href="/settings" aria-label={dict.common.settings} className={ROUND_BUTTON}>
            <IconSettings width={20} height={20} />
          </Link>
        </div>
      }
    />
  );
}
