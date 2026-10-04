"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Panel } from "@/components/ui";
import { setLocale } from "@/i18n/actions";
import { useI18n } from "@/i18n/client";
import { LOCALES, LOCALE_NAMES } from "@/i18n/config";

// Un <select>: con tante lingue resta comodo, e sul telefono apre il selettore di sistema.
export function LanguagePicker() {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Panel>
      <h2 className="mb-3 text-headline font-semibold">{dict.settings.language.title}</h2>
      <label htmlFor="language" className="label">
        {dict.settings.language.label}
      </label>
      <select
        id="language"
        className="field"
        value={locale}
        disabled={pending}
        aria-describedby="language-hint"
        onChange={(e) => {
          const next = e.target.value;
          startTransition(async () => {
            await setLocale(next);
            router.refresh();
          });
        }}
      >
        {LOCALES.map((l) => (
          <option key={l} value={l} lang={l}>
            {LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
      <p id="language-hint" className="mt-1.5 text-footnote text-muted">
        {dict.settings.language.hint}
      </p>
    </Panel>
  );
}
