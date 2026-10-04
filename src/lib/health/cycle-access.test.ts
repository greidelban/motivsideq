import { describe, expect, it } from "vitest";
import { CYCLE_POLICY_VERSION } from "@/lib/legal";
import { fromKg, toKg } from "@/lib/units";
import { canUseCycle, hasCycleData, isCycleVisible } from "./cycle-access";

const TODAY = new Date(2026, 9, 4);
const adultWoman = { sex: "female", birthYear: 1995, birthMonth: 3 } as const;
const consent = { acceptedAt: "2026-10-04T10:00:00Z", policyVersion: CYCLE_POLICY_VERSION, enabled: true };

describe("chi vede il Ciclo", () => {
  it("solo con sesso femmina; altrimenti non compare da nessuna parte", () => {
    expect(canUseCycle({ ...adultWoman, sex: "male" }, consent, TODAY)).toBe("hidden");
    expect(canUseCycle({ birthYear: 1995, birthMonth: 3 }, consent, TODAY)).toBe("hidden");
    expect(isCycleVisible("hidden")).toBe(false);
    expect(canUseCycle(adultWoman, consent, TODAY)).toBe("ok");
  });

  it("età: serve la data di nascita, e solo maggiorenni (ricalcolata da oggi)", () => {
    expect(canUseCycle({ sex: "female" }, consent, TODAY)).toBe("needBirth");
    expect(canUseCycle({ sex: "female", birthYear: 2010, birthMonth: 1 }, consent, TODAY)).toBe("tooYoung");
    // Compie 18 anni a settembre 2026: a ottobre sì, a settembre (mese del compleanno) non ancora.
    expect(canUseCycle({ sex: "female", birthYear: 2008, birthMonth: 9 }, consent, TODAY)).toBe("ok");
    expect(canUseCycle({ sex: "female", birthYear: 2008, birthMonth: 9 }, consent, new Date(2026, 8, 15))).toBe("tooYoung");
  });

  it("consenso: mancante o su un'informativa vecchia va ridato", () => {
    expect(canUseCycle(adultWoman, null, TODAY)).toBe("needConsent");
    expect(canUseCycle(adultWoman, { acceptedAt: "2026-09-01", enabled: true }, TODAY)).toBe("needConsent");
    expect(canUseCycle(adultWoman, { ...consent, policyVersion: "2025-01-01" }, TODAY)).toBe("needConsent");
  });

  it("in pausa dopo aver conservato i dati", () => {
    expect(canUseCycle(adultWoman, { ...consent, enabled: false }, TODAY)).toBe("paused");
  });

  it("dati del ciclo presenti", () => {
    expect(hasCycleData([], [], null)).toBe(false);
    expect(hasCycleData([{}], [], null)).toBe(true);
    expect(hasCycleData([], [], consent)).toBe(true);
  });
});

describe("unità", () => {
  it("si salva in kg con un decimale", () => {
    expect(toKg(70, "kg")).toBe(70);
    expect(toKg(154.3, "lb")).toBe(70);
    expect(fromKg(70, "lb")).toBe(154.3);
    expect(fromKg(60.5, "kg")).toBe(60.5);
  });

  it("andata e ritorno non cambia il peso", () => {
    for (const kg of [45, 60.5, 72.3, 101.9]) expect(toKg(fromKg(kg, "lb"), "lb")).toBe(kg);
  });
});
