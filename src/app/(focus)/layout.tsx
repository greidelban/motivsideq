import type { ReactNode } from "react";

// Schermate a tutto schermo (giochi): niente barra in basso da toccare per sbaglio.
export default function FocusLayout({ children }: { children: ReactNode }) {
  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4"
      style={{
        paddingTop: "calc(var(--safe-top) + 12px)",
        paddingBottom: "calc(var(--safe-bottom) + 16px)",
      }}
    >
      {children}
    </main>
  );
}
