"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { Field, FormMessage, Panel } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { interpolate, plural } from "@/i18n/format";
import {
  type AuthErrorKey,
  type AuthFieldError,
  authErrorKey,
  emailOnlySchema,
  fieldErrors,
  newPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/auth/validation";
import { supabaseConfig } from "@/lib/supabase/config";
import { accountAvailable, loadSupabase, useSession } from "@/lib/supabase/client";
import { prepareDeviceWipe, signOutAndWipe } from "@/lib/sync/run";
import { VaultPanel } from "./VaultPanel";

type Mode = "signIn" | "signUp" | "forgot";
type Result = { tone: "error" | "success"; text: string } | null;

// Account facoltativo: serve solo al cloud cifrato (con l'abbonamento).
// Tutto avviene nel browser con la chiave pubblica; i permessi li decide la RLS,
// e i dati arrivano al server già cifrati (src/lib/crypto/vault.ts).
export function AccountView() {
  const { dict } = useI18n();
  const session = useSession();
  // Qui l'account serve: la libreria si prepara subito, così accedere è immediato.
  useEffect(() => {
    void loadSupabase();
  }, []);
  if (!accountAvailable()) {
    return (
      <Panel>
        <p className="text-subhead text-ink-2">{dict.settings.account.notConfigured}</p>
      </Panel>
    );
  }
  if (session === undefined) return <div className="min-h-64" />;
  return session ? <SignedIn email={session.user.email ?? ""} /> : <SignedOut />;
}

function SignedIn({ email }: { email: string }) {
  const { dict } = useI18n();
  const t = dict.settings.account;
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-4">
      <VaultPanel />
      <Panel>
        <p className="text-subhead text-ink-2">{interpolate(t.signedInAs, { email })}</p>
        <button
          type="button"
          className="btn btn-ghost mt-4"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            // Esce solo da questo dispositivo; i dati locali restano.
            await (await loadSupabase())?.auth.signOut({ scope: "local" });
            setBusy(false);
          }}
        >
          {t.signOut}
        </button>
        <WipeDevice />
      </Panel>
    </div>
  );
}

type WipeStep = "idle" | "confirm" | "checking" | "wiping" | { unsynced: number };

/** "Esci e togli i dati": prima un ultimo invio, poi avvisa se qualcosa andrebbe perso. */
function WipeDevice() {
  const { locale, dict } = useI18n();
  const t = dict.settings.account.wipe;
  const [step, setStep] = useState<WipeStep>("idle");
  const busy = step === "checking" || step === "wiping";

  async function wipe() {
    setStep("wiping");
    await signOutAndWipe();
  }

  async function confirm() {
    if (typeof step === "object") return wipe();
    setStep("checking");
    const unsynced = await prepareDeviceWipe();
    if (unsynced > 0) setStep({ unsynced });
    else await wipe();
  }

  if (step === "idle") {
    return (
      <button type="button" className="link mt-4 flex min-h-11 items-center text-start text-subhead" onClick={() => setStep("confirm")}>
        {t.open}
      </button>
    );
  }
  return (
    <div className="mt-4 space-y-3">
      <p className="text-subhead text-ink-2">{t.explain}</p>
      {typeof step === "object" && (
        <>
          <FormMessage tone="error">{plural(locale, step.unsynced, t.unsynced)}</FormMessage>
          <Link href="/settings" className="link flex min-h-11 items-center text-subhead">
            {t.backupFirst}
          </Link>
        </>
      )}
      {step === "checking" && (
        <p role="status" className="text-footnote text-muted">
          {t.checking}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-danger" disabled={busy} onClick={() => void confirm()}>
          {typeof step === "object" ? t.confirmAnyway : t.confirm}
        </button>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setStep("idle")}>
          {dict.common.cancel}
        </button>
      </div>
    </div>
  );
}

function SignedOut() {
  const { dict } = useI18n();
  const t = dict.settings.account;
  const [mode, setMode] = useState<Mode>("signIn");

  return (
    <div className="space-y-4">
      <Panel>
        <p className="text-subhead text-ink-2">{t.local}</p>
        <p className="mt-2 text-footnote text-muted">{t.why}</p>
      </Panel>
      {mode !== "forgot" && (
        <div className="glass flex gap-1 rounded-full p-1" role="tablist">
          {(["signIn", "signUp"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`min-h-11 flex-1 rounded-full text-subhead font-semibold transition-colors duration-150 ${
                mode === m ? "text-ink" : "text-muted hover:text-ink-2"
              }`}
              style={mode === m ? { background: "var(--glass-lens)", boxShadow: "var(--glass-lens-edge)" } : undefined}
            >
              {t[m]}
            </button>
          ))}
        </div>
      )}
      <Panel>
        {mode === "signIn" && <SignInForm onForgot={() => setMode("forgot")} />}
        {mode === "signUp" && <SignUpForm />}
        {mode === "forgot" && <ForgotForm onBack={() => setMode("signIn")} />}
      </Panel>
    </div>
  );
}

/** Stato comune dei moduli: errori per campo, messaggio, attesa. */
function useAuthForm() {
  const { dict } = useI18n();
  const t = dict.settings.account;
  const [errors, setErrors] = useState<Partial<Record<string, AuthFieldError>>>({});
  const [result, setResult] = useState<Result>(null);
  const [busy, setBusy] = useState(false);
  return {
    busy,
    result,
    fieldError: (name: string) => (errors[name] ? [t.errors[errors[name]!]] : undefined),
    async run(task: () => Promise<Result | void>) {
      setBusy(true);
      setResult(null);
      try {
        const r = await task();
        if (r) setResult(r);
      } catch {
        setResult({ tone: "error", text: t.errors.network });
      } finally {
        setBusy(false);
      }
    },
    setErrors,
    authError: (key: AuthErrorKey): Result => ({ tone: "error", text: t.errors[key] }),
  };
}

const formValues = (e: FormEvent<HTMLFormElement>) => Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;

function SignInForm({ onForgot }: { onForgot: () => void }) {
  const { dict } = useI18n();
  const t = dict.settings.account;
  const form = useAuthForm();

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = signInSchema.safeParse(formValues(e));
    form.setErrors(parsed.success ? {} : fieldErrors(parsed.error));
    if (!parsed.success) return;
    void form.run(async () => {
      const { error } = await (await loadSupabase())!.auth.signInWithPassword(parsed.data);
      if (error) return form.authError(authErrorKey(error.code, error.status));
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label={t.email} name="email" type="email" autoComplete="email" inputMode="email" required error={form.fieldError("email")} />
      <Field label={t.password} name="password" type="password" autoComplete="current-password" required error={form.fieldError("password")} />
      {form.result && <FormMessage tone={form.result.tone}>{form.result.text}</FormMessage>}
      <button type="submit" className="btn btn-primary w-full" disabled={form.busy}>
        {form.busy ? t.working : t.signIn}
      </button>
      <button type="button" className="link flex min-h-11 items-center text-subhead" onClick={onForgot}>
        {t.forgot}
      </button>
    </form>
  );
}

function SignUpForm() {
  const { dict } = useI18n();
  const t = dict.settings.account;
  const form = useAuthForm();
  const [privacyBefore, privacyAfter] = t.privacy.split("{link}");

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = signUpSchema.safeParse(formValues(e));
    form.setErrors(parsed.success ? {} : fieldErrors(parsed.error));
    if (!parsed.success) return;
    const { email, password } = parsed.data;
    void form.run(async () => {
      const { error } = await (await loadSupabase())!.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${supabaseConfig()!.siteUrl}/auth/confirm` },
      });
      // Un'email già registrata riceve lo stesso messaggio: non si rivela chi è iscritto.
      if (error && error.code !== "user_already_exists") return form.authError(authErrorKey(error.code, error.status));
      return { tone: "success", text: interpolate(t.checkEmail, { email }) };
    });
  }

  if (form.result?.tone === "success") return <FormMessage tone="success">{form.result.text}</FormMessage>;
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label={t.email} name="email" type="email" autoComplete="email" inputMode="email" required error={form.fieldError("email")} />
      <Field
        label={t.password}
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint={t.passwordHint}
        error={form.fieldError("password")}
      />
      <Field
        label={t.passwordConfirm}
        name="passwordConfirm"
        type="password"
        autoComplete="new-password"
        required
        error={form.fieldError("passwordConfirm")}
      />
      <p className="text-footnote text-muted">
        {privacyBefore}
        <Link href="/privacy" className="link">
          {t.privacyLink}
        </Link>
        {privacyAfter}
      </p>
      {form.result && <FormMessage tone={form.result.tone}>{form.result.text}</FormMessage>}
      <button type="submit" className="btn btn-primary w-full" disabled={form.busy}>
        {form.busy ? t.working : t.signUp}
      </button>
    </form>
  );
}

function ForgotForm({ onBack }: { onBack: () => void }) {
  const { dict } = useI18n();
  const t = dict.settings.account;
  const form = useAuthForm();

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = emailOnlySchema.safeParse(formValues(e));
    form.setErrors(parsed.success ? {} : fieldErrors(parsed.error));
    if (!parsed.success) return;
    void form.run(async () => {
      const { error } = await (await loadSupabase())!.auth.resetPasswordForEmail(parsed.data.email, {
        redirectTo: `${supabaseConfig()!.siteUrl}/auth/confirm`,
      });
      if (error && (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit")) {
        return form.authError("rateLimit");
      }
      return { tone: "success", text: t.resetSent };
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label={t.email} name="email" type="email" autoComplete="email" inputMode="email" required error={form.fieldError("email")} />
      {form.result && <FormMessage tone={form.result.tone}>{form.result.text}</FormMessage>}
      <button type="submit" className="btn btn-primary w-full" disabled={form.busy}>
        {form.busy ? t.working : t.sendReset}
      </button>
      <button type="button" className="link flex min-h-11 items-center text-subhead" onClick={onBack}>
        {t.backToSignIn}
      </button>
    </form>
  );
}

/** Nuova password, dopo il link di recupero (la sessione c'è già). */
export function NewPasswordForm({ onDone }: { onDone: () => void }) {
  const { dict } = useI18n();
  const t = dict.settings.account;
  const form = useAuthForm();

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = newPasswordSchema.safeParse(formValues(e));
    form.setErrors(parsed.success ? {} : fieldErrors(parsed.error));
    if (!parsed.success) return;
    void form.run(async () => {
      const { error } = await (await loadSupabase())!.auth.updateUser({ password: parsed.data.password });
      if (error) return form.authError(authErrorKey(error.code, error.status));
      onDone();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field
        label={t.newPassword}
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint={t.passwordHint}
        error={form.fieldError("password")}
      />
      <Field
        label={t.passwordConfirm}
        name="passwordConfirm"
        type="password"
        autoComplete="new-password"
        required
        error={form.fieldError("passwordConfirm")}
      />
      {form.result && <FormMessage tone={form.result.tone}>{form.result.text}</FormMessage>}
      <button type="submit" className="btn btn-primary w-full" disabled={form.busy}>
        {form.busy ? t.working : t.setPassword}
      </button>
    </form>
  );
}
