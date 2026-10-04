"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { IconFood, IconJournal, IconMind, IconToday, IconWorkout } from "@/components/icons";
import { useI18n } from "@/i18n/client";

const TABS = [
  { href: "/today", key: "today", Icon: IconToday },
  { href: "/mind", key: "mind", Icon: IconMind },
  { href: "/journal", key: "journal", Icon: IconJournal },
  { href: "/gym", key: "gym", Icon: IconWorkout },
  { href: "/food", key: "food", Icon: IconFood },
] as const;

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

export function TabBar() {
  const pathname = usePathname();
  const { dict } = useI18n();
  // La scheda toccata si accende subito, senza aspettare la pagina: vale finché
  // si è ancora sulla pagina di partenza (poi comanda l'URL).
  const [pending, setPending] = useState<{ href: string; from: string } | null>(null);
  const shownHref = pending && pending.from === pathname ? pending.href : TABS.find((t) => isActive(pathname, t.href))?.href;
  const index = TABS.findIndex((t) => t.href === shownHref);

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
              transform: `translateX(${Math.max(index, 0) * 100}%)`,
              opacity: index < 0 ? 0 : 1,
            }}
          />
        </div>
        <ul className="relative flex h-full items-stretch">
          {TABS.map(({ href, key, Icon }) => {
            const active = href === shownHref;
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  prefetch
                  aria-current={isActive(pathname, href) ? "page" : undefined}
                  onClick={() => setPending({ href, from: pathname })}
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
