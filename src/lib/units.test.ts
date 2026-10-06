import { describe, expect, it } from "vitest";
import { cmToFeetInches, feetInchesToCm, fromKg, toKg } from "./units";

describe("unità", () => {
  it("kg e libbre", () => {
    expect(toKg(150, "lb")).toBe(68);
    expect(fromKg(68, "lb")).toBe(149.9);
    expect(toKg(68, "kg")).toBe(68);
  });

  it("piedi e pollici: le altezze dei profili di prova", () => {
    // Giorgio 178 cm, Marta 155 cm.
    expect(cmToFeetInches(178)).toEqual({ feet: 5, inches: 10 });
    expect(cmToFeetInches(155)).toEqual({ feet: 5, inches: 1 });
    expect(feetInchesToCm(5, 10)).toBe(177.8);
    expect(feetInchesToCm(5, 1)).toBe(154.9);
  });

  it("pollici arrotondati che arrivano a 12 passano al piede dopo", () => {
    expect(cmToFeetInches(182.6)).toEqual({ feet: 6, inches: 0 });
  });
});

describe("profili di prova", async () => {
  const { PERSONAS } = await import("@/lib/dev/personas");
  const { profileAge, profileAgeGroup } = await import("@/lib/profile/profile");
  const { canUseCycle } = await import("@/lib/health/cycle-access");
  const today = new Date(2026, 9, 6);

  it("20 anni entrambi: Marta può usare il Ciclo (dopo il consenso), Giorgio no", () => {
    expect(profileAge(PERSONAS.giorgio.profile, today)).toBe(20);
    expect(profileAge(PERSONAS.marta.profile, today)).toBe(20);
    expect(profileAgeGroup(PERSONAS.marta.profile, today)).toBe("adult");
    expect(canUseCycle(PERSONAS.marta.profile, null, today)).toBe("needConsent");
    expect(canUseCycle(PERSONAS.giorgio.profile, null, today)).toBe("hidden");
  });
});
