import { z } from "zod";

// Regole dei campi di accesso. I messaggi sono chiavi dei dizionari
// (settings.account.errors): i componenti li traducono.

export type AuthFieldError = "email" | "passwordShort" | "passwordLong" | "passwordMissing" | "passwordMismatch";

const email = z.string().trim().toLowerCase().max(254).pipe(z.email("email"));

// 72 è il limite di bcrypt usato da Supabase Auth.
const password = z.string().min(8, "passwordShort").max(72, "passwordLong");

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "passwordMissing").max(72, "passwordLong"),
});

export const signUpSchema = z
  .object({ email, password, passwordConfirm: z.string() })
  .refine((v) => v.password === v.passwordConfirm, { path: ["passwordConfirm"], message: "passwordMismatch" });

export const emailOnlySchema = z.object({ email });

export const newPasswordSchema = z
  .object({ password, passwordConfirm: z.string() })
  .refine((v) => v.password === v.passwordConfirm, { path: ["passwordConfirm"], message: "passwordMismatch" });

/** Primo errore per ciascun campo, come chiave del dizionario. */
export function fieldErrors(error: z.ZodError): Partial<Record<string, AuthFieldError>> {
  const out: Partial<Record<string, AuthFieldError>> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "");
    out[field] ??= issue.message as AuthFieldError;
  }
  return out;
}

export type AuthErrorKey = "invalidCredentials" | "notConfirmed" | "rateLimit" | "weakPassword" | "samePassword" | "network" | "generic";

/** Messaggi volutamente generici: non si rivela mai se un'email è registrata. */
export function authErrorKey(code: string | undefined, status?: number): AuthErrorKey {
  switch (code) {
    case "invalid_credentials":
      return "invalidCredentials";
    case "email_not_confirmed":
      return "notConfirmed";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "rateLimit";
    case "weak_password":
      return "weakPassword";
    case "same_password":
      return "samePassword";
    default:
      return status === 0 ? "network" : "generic";
  }
}
