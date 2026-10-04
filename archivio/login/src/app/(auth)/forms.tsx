"use client";

import { useActionState } from "react";
import { Field, FormMessage } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { initialFormState } from "@/lib/forms";
import { requestPasswordReset, signIn, signUp, updatePassword } from "./actions";

export function SignInForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signIn, initialFormState);
  return (
    <form action={action} className="space-y-4" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={state.fieldErrors?.password}
      />
      {state.status === "error" && state.message && <FormMessage tone="error">{state.message}</FormMessage>}
      <SubmitButton className="w-full" pendingLabel="Accesso…">
        Accedi
      </SubmitButton>
    </form>
  );
}

export function SignUpForm() {
  const [state, action] = useActionState(signUp, initialFormState);
  if (state.status === "success") return <FormMessage tone="success">{state.message}</FormMessage>;
  return (
    <form action={action} className="space-y-4" noValidate>
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        hint="Almeno 8 caratteri."
        error={state.fieldErrors?.password}
      />
      <Field
        label="Ripeti la password"
        name="passwordConfirm"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.passwordConfirm}
      />
      {state.status === "error" && state.message && <FormMessage tone="error">{state.message}</FormMessage>}
      <SubmitButton className="w-full" pendingLabel="Creazione…">
        Crea account
      </SubmitButton>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, initialFormState);
  if (state.status === "success") return <FormMessage tone="success">{state.message}</FormMessage>;
  return (
    <form action={action} className="space-y-4" noValidate>
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      {state.status === "error" && state.message && <FormMessage tone="error">{state.message}</FormMessage>}
      <SubmitButton className="w-full" pendingLabel="Invio…">
        Invia il link
      </SubmitButton>
    </form>
  );
}

export function NewPasswordForm() {
  const [state, action] = useActionState(updatePassword, initialFormState);
  return (
    <form action={action} className="space-y-4" noValidate>
      <Field
        label="Nuova password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        hint="Almeno 8 caratteri."
        error={state.fieldErrors?.password}
      />
      <Field
        label="Ripeti la password"
        name="passwordConfirm"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.passwordConfirm}
      />
      {state.status === "error" && state.message && <FormMessage tone="error">{state.message}</FormMessage>}
      <SubmitButton className="w-full" pendingLabel="Salvataggio…">
        Salva la password
      </SubmitButton>
    </form>
  );
}
