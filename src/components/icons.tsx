import type { SVGProps } from "react";

// Icone a tratto (24×24, currentColor). Inline per non aggiungere dipendenze.
type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconToday = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Icon>
);

export const IconJournal = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6z" />
    <path d="M6 3v18M10 8h5M10 12h5" />
  </Icon>
);

export const IconWorkout = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 7v10M18 7v10M3 9.5v5M21 9.5v5M6 12h12" />
  </Icon>
);

export const IconFood = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 3v8a2 2 0 0 0 2 2v8M11 3v8a2 2 0 0 1-2 2M9 3v6" />
    <path d="M17 21V3c-2 1.5-3 4-3 7v3h3" />
  </Icon>
);

export const IconInfo = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </Icon>
);

export const IconMind = (p: IconProps) => (
  <Icon {...p}>
    <path d="M13 2 4.5 13.5H12l-1 8.5 8.5-11.5H12z" />
  </Icon>
);

export const IconSettings = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </Icon>
);

/** Chat in incognito: un fumetto disegnato a tratteggio (non resta traccia). */
export const IconChatIncognito = (p: IconProps) => (
  <Icon {...p}>
    <path
      d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5z"
      strokeDasharray="2.2 2.8"
    />
  </Icon>
);

export const IconLock = (p: IconProps) => (
  <Icon {...p}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Icon>
);

export const IconHealth = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" />
    <path d="M7.5 12.5h2.2l1.3-2.3 2 4 1.3-1.7h2.2" />
  </Icon>
);

export const IconDrop = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3c3.2 4.2 6 7.6 6 11a6 6 0 0 1-12 0c0-3.4 2.8-6.8 6-11z" />
  </Icon>
);

export const IconTrash = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l.9 12.5h9.2L17.5 7" />
  </Icon>
);

// Frecce di direzione: in una lingua da destra a sinistra si specchiano.
export const IconChevronLeft = (p: IconProps) => (
  <Icon {...p} className={`rtl:-scale-x-100 ${p.className ?? ""}`}>
    <path d="M15 5l-7 7 7 7" />
  </Icon>
);

export const IconChevronRight = (p: IconProps) => (
  <Icon {...p} className={`rtl:-scale-x-100 ${p.className ?? ""}`}>
    <path d="M9 5l7 7-7 7" />
  </Icon>
);
