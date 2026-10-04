"use client";

import type { EmailOtpType } from "@supabase/supabase-js";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FormMessage, Panel } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { loadSupabase } from "@/lib/supabase/client";
import { NewPasswordForm } from "./AccountView";

const OTP_TYPES: readonly EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

type State = "checking" | "confirmed" | "recovery" | "passwordUpdated" | "invalid";

// Destinazione dei link nelle email (conferma account, recupero password).
// Template con token_hash: funzionano anche aprendo l'email su un altro dispositivo.
export function ConfirmView() {
  const { dict } = useI18n();
  const t = dict.settings.account;
  const params = useSearchParams();
  const [state, setState] = useState<State>("checking");
  const started = useRef(false);

  useEffect(() => {
    // Il token vale una volta sola: niente doppia verifica (StrictMode, nuovi render).
    if (started.current) return;
    started.current = true;
    const tokenHash = params.get("token_hash");
    const type = params.get("type") as EmailOtpType | null;
    // Il codice non resta nell'indirizzo né nella cronologia del browser.
    window.history.replaceState(null, "", window.location.pathname);
    const check = loadSupabase().then((supabase) =>
      supabase && tokenHash && type && OTP_TYPES.includes(type)
        ? supabase.auth
            .verifyOtp({ type, token_hash: tokenHash })
            .then(({ error }): State => (error ? "invalid" : type === "recovery" ? "recovery" : "confirmed"))
        : ("invalid" as const),
    );
    check.then(setState).catch(() => setState("invalid"));
  }, [params]);

  return (
    <Panel className="space-y-4">
      {state === "checking" && <p className="text-subhead text-muted">{t.confirming}</p>}
      {state === "invalid" && <FormMessage tone="error">{t.linkInvalid}</FormMessage>}
      {state === "confirmed" && <FormMessage tone="success">{t.confirmed}</FormMessage>}
      {state === "passwordUpdated" && <FormMessage tone="success">{t.passwordUpdated}</FormMessage>}
      {state === "recovery" && <NewPasswordForm onDone={() => setState("passwordUpdated")} />}
      {state !== "checking" && state !== "recovery" && (
        <Link href="/account" className="btn btn-primary w-full">
          {t.manage}
        </Link>
      )}
    </Panel>
  );
}
