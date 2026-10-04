"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconDrop, IconFood, IconWorkout } from "@/components/icons";
import { useI18n } from "@/i18n/client";
import { canUseCycle, isCycleVisible } from "@/lib/health/cycle-access";
import { cycleConsent } from "@/lib/health/store";
import { profile } from "@/lib/profile/store";

const SECTIONS = [
  { href: "/health/training", key: "training", Icon: IconWorkout },
  { href: "/health/food", key: "food", Icon: IconFood },
  { href: "/health/cycle", key: "cycle", Icon: IconDrop },
] as const;

// Sotto-menu di Salute. Il Ciclo compare solo se canUseCycle lo permette (sesso "donna").
export function HealthNav() {
  const pathname = usePathname();
  const { dict } = useI18n();
  const cycleVisible = isCycleVisible(canUseCycle(profile.use(), cycleConsent.use()));
  const sections = SECTIONS.filter((s) => s.key !== "cycle" || cycleVisible);

  return (
    <nav aria-label={dict.health.sectionsLabel} className="glass mb-4 flex gap-1 rounded-full p-1">
      {sections.map(({ href, key, Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            prefetch
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full text-subhead font-semibold transition-colors duration-150 ${
              active ? "text-ink" : "text-muted hover:text-ink-2"
            }`}
            style={active ? { background: "var(--glass-lens)", boxShadow: "var(--glass-lens-edge)" } : undefined}
          >
            <Icon width={18} height={18} />
            {dict.health.sections[key]}
          </Link>
        );
      })}
    </nav>
  );
}
