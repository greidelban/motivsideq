import { z } from "zod";

const email = z.string().trim().toLowerCase().max(254).pipe(z.email("Inserisci un'email valida."));

// 72 è il limite di bcrypt usato da Supabase Auth.
const password = z
  .string()
  .min(8, "La password deve avere almeno 8 caratteri.")
  .max(72, "La password può avere al massimo 72 caratteri.");

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Inserisci la password.").max(72),
});

export const signUpSchema = z
  .object({ email, password, passwordConfirm: z.string() })
  .refine((v) => v.password === v.passwordConfirm, {
    path: ["passwordConfirm"],
    message: "Le password non coincidono.",
  });

export const emailOnlySchema = z.object({ email });

export const newPasswordSchema = z
  .object({ password, passwordConfirm: z.string() })
  .refine((v) => v.password === v.passwordConfirm, {
    path: ["passwordConfirm"],
    message: "Le password non coincidono.",
  });
