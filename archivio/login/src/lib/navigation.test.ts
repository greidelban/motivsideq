import { describe, expect, it } from "vitest";
import { isGuestOnlyPath, isPublicPath, safeNextPath } from "./navigation";

describe("safeNextPath", () => {
  it("accetta percorsi interni", () => {
    expect(safeNextPath("/diario")).toBe("/diario");
    expect(safeNextPath("/allenamento?x=1")).toBe("/allenamento?x=1");
  });

  it("rifiuta redirect verso altri siti", () => {
    expect(safeNextPath("https://evil.example")).toBe("/oggi");
    expect(safeNextPath("//evil.example")).toBe("/oggi");
    expect(safeNextPath("/\\evil.example")).toBe("/oggi");
    expect(safeNextPath("diario")).toBe("/oggi");
  });

  it("usa il fallback se manca", () => {
    expect(safeNextPath(null)).toBe("/oggi");
    expect(safeNextPath(undefined, "/x")).toBe("/x");
  });
});

describe("percorsi pubblici", () => {
  it("riconosce le pagine pubbliche e le loro sottopagine", () => {
    expect(isPublicPath("/accedi")).toBe(true);
    expect(isPublicPath("/auth/confirm")).toBe(true);
    expect(isPublicPath("/privacy")).toBe(true);
  });

  it("non confonde prefissi simili", () => {
    expect(isPublicPath("/accedi-admin")).toBe(false);
    expect(isPublicPath("/oggi")).toBe(false);
    expect(isPublicPath("/nuova-password")).toBe(false);
  });

  it("le pagine solo-ospite non includono privacy né conferma email", () => {
    expect(isGuestOnlyPath("/registrati")).toBe(true);
    expect(isGuestOnlyPath("/privacy")).toBe(false);
    expect(isGuestOnlyPath("/auth/confirm")).toBe(false);
  });
});
