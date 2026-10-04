import type { Metadata } from "next";
import Link from "next/link";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.errors.notFoundTitle };
}

export default async function NotFound() {
  const { dict } = await getI18n();
  const t = dict.errors;
  return (
    <main
      className="mx-auto grid min-h-dvh w-full max-w-md place-items-center px-4"
      style={{ paddingTop: "var(--safe-top)", paddingBottom: "var(--safe-bottom)" }}
    >
      <section className="glass-elevated w-full space-y-4 rounded-xl p-6 text-center">
        <h1 className="text-title2 font-bold">{t.notFoundTitle}</h1>
        <p className="text-subhead text-ink-2">{t.notFoundText}</p>
        <Link href="/today" className="btn btn-primary w-full">
          {t.home}
        </Link>
      </section>
    </main>
  );
}
