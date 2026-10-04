import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { interpolate } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { APP_NAME } from "@/lib/app";

// Versione per l'app senza account (dati solo sul dispositivo).
// Quella per l'app con account e server è in archivio/login/src/app/privacy.
// TODO prima della pubblicazione: completare i dati del titolare (vedi DA_FARE.md).
const CONTROLLER = "[Name / company of the data controller]";
const CONTACT = "[privacy contact email]";
const LAST_UPDATE = new Date(2026, 9, 3);

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Privacy" };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-title3 font-semibold">{title}</h2>
      <div className="space-y-2 text-subhead text-ink-2">{children}</div>
    </section>
  );
}

export default async function PrivacyPage() {
  const { locale, dict } = await getI18n();
  const t = dict.privacy;
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(LAST_UPDATE);

  return (
    <main
      className="mx-auto w-full max-w-2xl px-4"
      style={{ paddingTop: "calc(var(--safe-top) + 24px)", paddingBottom: "calc(var(--safe-bottom) + 32px)" }}
    >
      <article className="glass-elevated space-y-6 rounded-xl p-6">
        <header>
          <p className="eyebrow mb-1">{interpolate(t.updated, { date })}</p>
          <h1 className="text-title1 font-bold">{interpolate(t.title, { app: APP_NAME })}</h1>
          <p className="mt-2 text-subhead text-muted">{t.intro}</p>
        </header>

        <Section title={t.where.title}>
          <p>{t.where.p1}</p>
          <p>{t.where.p2}</p>
        </Section>

        <Section title={t.controller.title}>
          <p>{interpolate(t.controller.body, { controller: CONTROLLER, contact: CONTACT })}</p>
        </Section>

        <Section title={t.cookies.title}>
          <p>{t.cookies.body}</p>
        </Section>

        <Section title={t.age.title}>
          <p>{t.age.body}</p>
        </Section>

        <Section title={t.future.title}>
          <p>{t.future.body}</p>
        </Section>

        <Section title={t.health.title}>
          <p>{dict.legal.disclaimer}</p>
        </Section>

        <p className="text-subhead">
          <Link href="/today" className="link">
            {dict.common.backToApp}
          </Link>
        </p>
      </article>
    </main>
  );
}
