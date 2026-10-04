import { describe, expect, it } from "vitest";
import { authErrorKey, fieldErrors, newPasswordSchema, signInSchema, signUpSchema } from "./validation";

describe("campi di accesso", () => {
  it("email pulita e in minuscolo", () => {
    const r = signInSchema.safeParse({ email: "  Anna@Example.COM ", password: "x" });
    expect(r.success && r.data.email).toBe("anna@example.com");
  });

  it("errori per campo come chiavi del dizionario", () => {
    const r = signUpSchema.safeParse({ email: "non-email", password: "corta", passwordConfirm: "diversa" });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error)).toEqual({ email: "email", password: "passwordShort", passwordConfirm: "passwordMismatch" });
  });

  it("password: almeno 8, al massimo 72 caratteri", () => {
    expect(newPasswordSchema.safeParse({ password: "12345678", passwordConfirm: "12345678" }).success).toBe(true);
    const long = "a".repeat(73);
    const r = newPasswordSchema.safeParse({ password: long, passwordConfirm: long });
    expect(!r.success && fieldErrors(r.error).password).toBe("passwordLong");
  });

  it("messaggi generici: non rivelano se l'email esiste", () => {
    expect(authErrorKey("invalid_credentials")).toBe("invalidCredentials");
    expect(authErrorKey("user_not_found")).toBe("generic");
    expect(authErrorKey("over_email_send_rate_limit")).toBe("rateLimit");
    expect(authErrorKey(undefined, 0)).toBe("network");
  });
});
