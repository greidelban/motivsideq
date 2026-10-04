"use client";

import Link from "next/link";
import { Panel } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { interpolate } from "@/i18n/format";
import { accountAvailable, useSession } from "@/lib/supabase/client";

// Riquadro in Impostazioni: stato dell'account e link alla pagina /account.
// Senza Supabase configurato non compare (l'app resta solo locale).
export function AccountPanel() {
  const { dict } = useI18n();
  const t = dict.settings.account;
  const session = useSession();
  if (!accountAvailable() || session === undefined) return null;

  return (
    <Panel>
      <h2 className="mb-2 text-headline font-semibold">{t.title}</h2>
      <p className="text-subhead text-ink-2">{session ? interpolate(t.signedInAs, { email: session.user.email ?? "" }) : t.local}</p>
      <Link href="/account" className={`btn mt-4 w-full ${session ? "btn-ghost" : "btn-primary"}`}>
        {session ? t.manage : t.open}
      </Link>
    </Panel>
  );
}
