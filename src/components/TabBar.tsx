"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { IconHealth, IconJournal, IconMind, IconToday } from "@/components/icons";
import { localeDir } from "@/i18n/config";
import { useI18n } from "@/i18n/client";

// `section`: la parte di URL che accende la scheda (Salute porta ad Allenamento
// ma resta accesa anche su Cibo e Ciclo).
const TABS = [
  { href: "/today", section: "/today", key: "today", Icon: IconToday },
  { href: "/mind", section: "/mind", key: "mind", Icon: IconMind },
  { href: "/journal", section: "/journal", key: "journal", Icon: IconJournal },
  { href: "/health/training", section: "/health", key: "health", Icon: IconHealth },
] as const;

const isActive = (pathname: string, section: string) => pathname === section || pathname.startsWith(`${section}/`);

export function TabBar() {
  const pathname = usePathname();
  const { locale, dict } = useI18n();
  const step = localeDir(locale) === "rtl" ? -100 : 100;
  // La scheda toccata si accende subito, senza aspettare la pagina: vale finché
  // si è ancora sulla pagina di partenza (poi comanda l'URL).
  const [pending, setPending] = useState<{ section: string; from: string } | null>(null);
  const shown = pending && pending.from === pathname ? pending.section : TABS.find((t) => isActive(pathname, t.section))?.section;
  const index = TABS.findIndex((t) => t.section === shown);

  return (
    <nav
      aria-label={dict.nav.label}
      className="fixed inset-x-0 z-40 mx-auto max-w-md px-3"
      style={{ bottom: "calc(var(--safe-bottom) + 10px)" }}
    >
      <div className="glass relative h-[var(--tabbar-height)] rounded-full p-1.5">
        {/* Lente di vetro che scivola sotto la scheda attiva. */}
        <div className="pointer-events-none absolute inset-1.5" aria-hidden="true">
          <span
            className="tab-lens block h-full rounded-full"
            style={{
              width: `${100 / TABS.length}%`,
              transform: `translateX(${Math.max(index, 0) * step}%)`,
              opacity: index < 0 ? 0 : 1,
            }}
          />
        </div>
        <ul className="relative flex h-full items-stretch">
          {TABS.map(({ href, section, key, Icon }) => {
            const active = section === shown;
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  prefetch
                  aria-current={isActive(pathname, section) ? "page" : undefined}
                  onClick={() => setPending({ section, from: pathname })}
                  className={`flex h-full flex-col items-center justify-center gap-0.5 rounded-full text-caption2 font-medium transition-colors duration-150 ${
                    active ? "text-ink" : "text-muted hover:text-ink-2"
                  }`}
                >
                  <Icon width={22} height={22} className={`tab-icon ${active ? "tab-icon-active" : ""}`} />
                  <span className="max-w-full truncate px-1">{dict.nav[key]}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
