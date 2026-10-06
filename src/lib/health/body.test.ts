import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import { assessBody, bmi, bmiCategory, healthyRange, liftsOften } from "./body";
import { MAX_MY_TYPES, addMyType, myTypes } from "./workouts";

const TODAY = "2026-10-06";
const NOW = new Date(2026, 9, 6);
// Profili di prova: Giorgio (178 cm, 68 kg) e Marta (155 cm, 47 kg), nati a gennaio 2006.
const giorgio = { sex: "male", heightCm: 178, birthYear: 2006, birthMonth: 1 } as const;
const marta = { sex: "female", heightCm: 155, birthYear: 2006, birthMonth: 1 } as const;
const gym = (n: number, from = TODAY) => Array.from({ length: n }, (_, i) => ({ type: "gym" as const, day: addDays(from, -i * 3) }));

describe("peso e altezza", () => {
  it("IMC e categorie dell'OMS", () => {
    expect(bmi(68, 178)).toBe(21.5);
    expect(bmi(47, 155)).toBe(19.6);
    expect(bmiCategory(18.4)).toBe("under");
    expect(bmiCategory(18.5)).toBe("normal");
    expect(bmiCategory(24.9)).toBe("normal");
    expect(bmiCategory(25)).toBe("over");
    expect(bmiCategory(30)).toBe("obese");
    expect(healthyRange(178)).toEqual({ min: 58.6, max: 78.9 });
  });

  it("i profili di prova sono nell'intervallo consigliato", () => {
    expect(assessBody(giorgio, 68, [], TODAY, NOW)).toMatchObject({ kind: "adult", bmi: 21.5, category: "normal", muscular: false, waist: null });
    expect(assessBody(marta, 47, [], TODAY, NOW)).toMatchObject({ kind: "adult", category: "normal" });
  });

  it("chi si allena spesso con i pesi: l'IMC alto può essere muscolo, il giro vita lo dice", () => {
    const heavy = { ...giorgio, waistCm: 82 };
    expect(liftsOften(gym(8), TODAY)).toBe(true);
    expect(liftsOften(gym(7), TODAY)).toBe(false);
    // 8 allenamenti ma più vecchi di 4 settimane: non contano.
    expect(liftsOften(gym(8, "2026-08-01"), TODAY)).toBe(false);
    expect(assessBody(heavy, 88, gym(10), TODAY, NOW)).toMatchObject({ category: "over", muscular: true, waist: "ok" });
    expect(assessBody({ ...heavy, waistCm: 95 }, 88, [], TODAY, NOW)).toMatchObject({ category: "over", muscular: false, waist: "high" });
    // Con un IMC normale "muscoloso" non serve.
    expect(assessBody(giorgio, 68, gym(10), TODAY, NOW)).toMatchObject({ muscular: false });
  });

  it("sotto i 18 anni nessun giudizio; senza dati si dice cosa manca", () => {
    expect(assessBody({ ...giorgio, birthYear: 2010 }, 60, [], TODAY, NOW)).toEqual({ kind: "minor" });
    expect(assessBody(giorgio, null, [], TODAY, NOW)).toEqual({ kind: "missing" });
    expect(assessBody({ sex: "male", heightCm: 178 }, 68, [], TODAY, NOW)).toEqual({ kind: "missing" });
  });
});

describe("i tuoi tipi di allenamento", () => {
  const w = (type: "gym" | "running" | "yoga" | "cycling" | "swimming", at: string) => ({ type, at });

  it("la prima volta: quelli usati di recente, al massimo quattro", () => {
    expect(myTypes([], [])).toEqual([]);
    const list = [w("gym", "2026-10-01"), w("running", "2026-10-03"), w("gym", "2026-10-05"), w("yoga", "2026-09-01")];
    expect(myTypes([], list)).toEqual(["gym", "running", "yoga"]);
    expect(myTypes(["cycling"], list)).toEqual(["cycling"]);
  });

  it("un tipo nuovo entra; con quattro esce quello usato meno di recente", () => {
    expect(addMyType(["gym"], "running", [])).toEqual(["gym", "running"]);
    expect(addMyType(["gym", "running"], "gym", [])).toEqual(["gym", "running"]);
    const full = ["gym", "running", "yoga", "cycling"] as const;
    expect(full.length).toBe(MAX_MY_TYPES);
    const list = [w("gym", "2026-10-05"), w("running", "2026-10-04"), w("yoga", "2026-09-01"), w("cycling", "2026-10-01")];
    expect(addMyType(full, "swimming", list)).toEqual(["gym", "running", "cycling", "swimming"]);
    // Mai usato: esce per primo.
    expect(addMyType(full, "swimming", list.filter((x) => x.type !== "cycling"))).toEqual(["gym", "running", "yoga", "swimming"]);
  });
});
