import { describe, expect, it } from "vitest";
import { signInSchema, signUpSchema } from "./auth";

describe("signUpSchema", () => {
  it("normalizza l'email", () => {
    const r = signUpSchema.parse({ email: "  Mario@Esempio.IT ", password: "password1", passwordConfirm: "password1" });
    expect(r.email).toBe("mario@esempio.it");
  });

  it("richiede password di almeno 8 caratteri e uguali", () => {
    expect(signUpSchema.safeParse({ email: "a@b.it", password: "corta", passwordConfirm: "corta" }).success).toBe(false);
    const r = signUpSchema.safeParse({ email: "a@b.it", password: "password1", passwordConfirm: "password2" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["passwordConfirm"]);
  });

  it("rifiuta password oltre i 72 caratteri (limite di bcrypt)", () => {
    const long = "x".repeat(73);
    expect(signUpSchema.safeParse({ email: "a@b.it", password: long, passwordConfirm: long }).success).toBe(false);
  });
});

describe("signInSchema", () => {
  it("rifiuta email non valide", () => {
    expect(signInSchema.safeParse({ email: "non-una-email", password: "x" }).success).toBe(false);
  });
});
