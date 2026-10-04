import type { Metadata } from "next";
import { IconChatIncognito, IconLock } from "@/components/icons";
import { LightLevel } from "@/components/light/LightLevel";
import { PageHeader, Panel } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { LOCAL_USER, can } from "@/lib/entitlements";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.chat.title };
}

// Chat in incognito: per ora solo predisposta e bloccata (arriverà con
// l'abbonamento, vedi entitlements.ts e DA_FARE.md). I messaggi resteranno solo in memoria.
export default async function ChatPage() {
  const { dict } = await getI18n();
  const t = dict.chat;
  const locked = !can(LOCAL_USER, "chat");
  return (
    <>
      <LightLevel energy={0.16} />
      <PageHeader eyebrow={t.eyebrow} title={t.title} back={{ href: "/today", label: dict.common.back }} />
      <div className="space-y-4">
        <Panel>
          <span className="card relative mb-4 grid size-14 place-items-center rounded-full text-ink" aria-hidden="true">
            <IconChatIncognito width={28} height={28} />
            {locked && (
              <span className="absolute -right-1 -bottom-1 grid size-6 place-items-center rounded-full bg-primary text-on-primary">
                <IconLock width={14} height={14} strokeWidth={2.2} />
              </span>
            )}
          </span>
          <p className="text-callout">{t.lead}</p>
          <ul className="mt-4 space-y-2 text-subhead text-ink-2">
            {[t.points.noSave, t.points.noHistory].map((point) => (
              <li key={point} className="flex gap-2.5">
                <span className="text-secondary" aria-hidden="true">
                  ●
                </span>
                {point}
              </li>
            ))}
          </ul>
          {locked && (
            <p className="card mt-4 flex items-center gap-2.5 px-3.5 py-3 text-subhead text-ink-2">
              <IconLock width={18} height={18} className="shrink-0 text-secondary" />
              {t.locked}
            </p>
          )}
        </Panel>

        {/* Senza motore il campo resta spento anche a chat sbloccata. */}
        <form className="glass flex items-center gap-2 rounded-full p-1.5">
          <label htmlFor="chat-message" className="sr-only">
            {t.placeholder}
          </label>
          <input id="chat-message" className="field min-w-0 flex-1 rounded-full border-transparent" placeholder={t.placeholder} disabled />
          <button type="submit" className="btn btn-primary" disabled>
            {t.send}
          </button>
        </form>
      </div>
    </>
  );
}
