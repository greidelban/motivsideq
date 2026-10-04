"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { type FormState, formDataToObject, validationError } from "@/lib/forms";
import { safeNextPath } from "@/lib/navigation";
import { emailOnlySchema, newPasswordSchema, signInSchema, signUpSchema } from "@/lib/validation/auth";

// Messaggi volutamente generici: non riveliamo se un'email è registrata.
function authErrorMessage(code: string | undefined): string {
  switch (code) {
    case "invalid_credentials":
      return "Email o password non corretti.";
    case "email_not_confirmed":
      return "Devi prima confermare l'email: controlla la posta (anche lo spam).";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Troppi tentativi. Riprova tra qualche minuto.";
    case "weak_password":
      return "Password troppo debole: usane una più lunga o meno prevedibile.";
    case "same_password":
      return "La nuova password deve essere diversa da quella attuale.";
    default:
      return "Qualcosa è andato storto. Riprova tra poco.";
  }
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formDataToObject(formData);
  const parsed = signInSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, { email: values.email ?? "" });

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { status: "error", message: authErrorMessage(error.code), values: { email: parsed.data.email } };

  redirect(safeNextPath(values.next));
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formDataToObject(formData);
  const parsed = signUpSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, { email: values.email ?? "" });

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: `${publicEnv().NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/oggi` },
  });
  if (error && error.code !== "user_already_exists") {
    return { status: "error", message: authErrorMessage(error.code), values: { email: parsed.data.email } };
  }
  return {
    status: "success",
    message: `Ti abbiamo inviato un'email a ${parsed.data.email}. Apri il link per confermare l'account (controlla anche lo spam).`,
  };
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formDataToObject(formData);
  const parsed = emailOnlySchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, { email: values.email ?? "" });

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnv().NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/nuova-password`,
  });
  if (error?.code === "over_email_send_rate_limit" || error?.code === "over_request_rate_limit") {
    return { status: "error", message: authErrorMessage(error.code) };
  }
  return {
    status: "success",
    message: "Se l'indirizzo è registrato, riceverai un'email con il link per scegliere una nuova password.",
  };
}

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = newPasswordSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { status: "error", message: authErrorMessage(error.code) };

  redirect("/oggi");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/accedi");
}
