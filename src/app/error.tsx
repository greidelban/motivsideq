"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useI18n } from "@/i18n/client";

// Una schermata che si rompe non deve lasciare una pagina bianca: si spiega,
// si rassicura sui dati (sono sul dispositivo, non in questa pagina) e si offre
// di riprovare o di tornare a Oggi.
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { dict } = useI18n();
  const t = dict.errors;

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main
      className="mx-auto grid min-h-dvh w-full max-w-md place-items-center px-4"
      style={{ paddingTop: "var(--safe-top)", paddingBottom: "var(--safe-bottom)" }}
    >
      <section role="alert" className="glass-elevated w-full space-y-4 rounded-xl p-6 text-center">
        <h1 className="text-title2 font-bold">{t.title}</h1>
        <p className="text-subhead text-ink-2">{t.text}</p>
        <div className="flex flex-col gap-2">
          <button type="button" className="btn btn-primary w-full" onClick={() => retry()}>
            {t.retry}
          </button>
          <Link href="/today" className="btn btn-ghost w-full">
            {t.home}
          </Link>
        </div>
      </section>
    </main>
  );
}
