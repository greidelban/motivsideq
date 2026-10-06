import { describe, expect, it } from "vitest";
import { daysBetween } from "@/lib/dates";
import { cleanName, effectiveGoal, isBirthAllowed, latestWeight, profileSchema, upsertWeight } from "@/lib/profile/profile";
import { bmrMifflin, checkCustomTargets, dailyTargets, targetKcal } from "./energy";
import { type FoodEntry, kcalConsistent, mealForHour, recentFoods, totals } from "./food";
import { type Workout, weekStart, weekSummary, workoutKcal } from "./workouts";

const TODAY = new Date(2026, 9, 4); // 4 ottobre 2026, domenica

describe("profilo", () => {
  it("accetta solo chi ha almeno 14 anni e date non future", () => {
    expect(isBirthAllowed(2012, 9, TODAY)).toBe(true); // 14 anni compiuti a settembre
    expect(isBirthAllowed(2012, 10, TODAY)).toBe(false); // mese del compleanno: non ancora
    expect(isBirthAllowed(2027, 1, TODAY)).toBe(false);
    expect(isBirthAllowed(2026, 11, TODAY)).toBe(false);
  });

  it("sotto i 18 anni niente obiettivo dimagrire", () => {
    expect(effectiveGoal({ goal: "lose", birthYear: 2010, birthMonth: 1 }, TODAY)).toBe("maintain");
    expect(effectiveGoal({ goal: "lose", birthYear: 1990, birthMonth: 1 }, TODAY)).toBe("lose");
    expect(effectiveGoal({}, TODAY)).toBe("maintain");
  });

  it("un peso per giorno, l'ultimo è quello attuale", () => {
    let w = upsertWeight([], { day: "2026-10-01", kg: 70 });
    w = upsertWeight(w, { day: "2026-10-03", kg: 69.5 });
    w = upsertWeight(w, { day: "2026-10-01", kg: 71 });
    expect(w).toEqual([
      { day: "2026-10-01", kg: 71 },
      { day: "2026-10-03", kg: 69.5 },
    ]);
    expect(latestWeight(w)?.kg).toBe(69.5);
    expect(latestWeight([])).toBeNull();
  });
});

describe("fabbisogno", () => {
  it("Mifflin-St Jeor", () => {
    expect(bmrMifflin({ sex: "male", kg: 80, cm: 180, age: 30 })).toBe(1780);
    expect(bmrMifflin({ sex: "female", kg: 60, cm: 165, age: 30 })).toBe(1320.25);
  });

  const adult = { sex: "male", heightCm: 180, birthYear: 1996, birthMonth: 1, activityLevel: "moderate" } as const;

  it("mantenimento, dimagrimento e massa", () => {
    // 80 kg, 30 anni: basale 1780 × 1,55 = 2759 → 2760
    expect(dailyTargets({ ...adult, goal: "maintain" }, 80, TODAY)).toMatchObject({ kcal: 2760, protein: 96 });
    expect(dailyTargets({ ...adult, goal: "lose" }, 80, TODAY)).toMatchObject({ kcal: 2360, protein: 128 });
    expect(dailyTargets({ ...adult, goal: "gain" }, 80, TODAY)).toMatchObject({ kcal: 3060 });
  });

  it("non scende mai sotto il basale né sotto la soglia (1200 donne, 1500 uomini)", () => {
    const small = { sex: "female", heightCm: 150, birthYear: 1950, birthMonth: 1, activityLevel: "sedentary", goal: "lose" } as const;
    expect(dailyTargets(small, 45, TODAY).kcal).toBe(1200);
    expect(dailyTargets({ ...small, sex: "male" }, 45, TODAY).kcal).toBe(1500);
  });

  it("carboidrati e grassi: 30% delle kcal dai grassi, il resto (tolte le proteine) carboidrati", () => {
    const t = dailyTargets({ ...adult, goal: "maintain" }, 80, TODAY);
    // 2760 kcal, 96 g di proteine: grassi 2760 × 0,3 / 9 = 92 g; carboidrati (2760 − 384 − 828) / 4 = 387 g.
    expect(t).toMatchObject({ kcal: 2760, protein: 96, fat: 92, carbs: 387, custom: false });
  });

  it("obiettivi scelti a mano: valgono solo sopra la soglia e mai sotto i 18 anni", () => {
    const custom = { protein: 150, carbs: 250, fat: 70 };
    expect(targetKcal(custom)).toBe(2230);
    expect(dailyTargets({ ...adult, customTargets: custom }, 80, TODAY)).toMatchObject({ kcal: 2230, ...custom, custom: true });
    // Basta il sesso: gli altri dati del profilo non servono.
    expect(dailyTargets({ sex: "female", customTargets: custom }, null, TODAY)).toMatchObject({ kcal: 2230, custom: true });
    expect(checkCustomTargets({ protein: 100, carbs: 150, fat: 40 }, "male")).toBe("low"); // 1360 kcal
    expect(checkCustomTargets({ protein: 100, carbs: 150, fat: 40 }, "female")).toBe("ok");
    expect(checkCustomTargets({ protein: 100, carbs: 150, fat: 40 }, undefined)).toBe("invalid");
    expect(checkCustomTargets({ protein: 400, carbs: 1000, fat: 100 }, "male")).toBe("high");
    // Una scelta troppo bassa salvata (es. dopo un cambio di sesso) non vale: si torna al calcolo.
    expect(dailyTargets({ ...adult, customTargets: { protein: 100, carbs: 150, fat: 40 } }, 80, TODAY).custom).toBe(false);
    const teen = { ...adult, birthYear: 2010, customTargets: custom } as const;
    expect(dailyTargets(teen, 60, TODAY)).toMatchObject({ kcal: null, carbs: null, fat: null, custom: false, minor: true });
  });

  it("dice cosa manca", () => {
    expect(dailyTargets({ sex: "female" }, null, TODAY)).toMatchObject({
      kcal: null,
      protein: null,
      missing: ["birth", "height", "weight", "activity"],
    });
  });

  it("dai 14 ai 17 anni nessun obiettivo calorico", () => {
    const teen = { ...adult, birthYear: 2010, goal: "lose" } as const;
    expect(dailyTargets(teen, 60, TODAY)).toMatchObject({ kcal: null, minor: true, protein: 72 });
  });
});

describe("allenamenti", () => {
  it("kcal = MET × kg × ore", () => {
    expect(workoutKcal({ type: "running", minutes: 30, intensity: 2 }, 70)).toBe(343);
    expect(workoutKcal({ type: "gym", minutes: 60, intensity: 1 }, 80)).toBe(280);
    expect(workoutKcal({ type: "gym", minutes: 60, intensity: 1 }, null)).toBeNull();
  });

  it("la settimana parte dal lunedì", () => {
    expect(weekStart("2026-10-04")).toBe("2026-09-28"); // domenica
    expect(weekStart("2026-09-28")).toBe("2026-09-28"); // lunedì
    expect(weekStart("2026-10-01")).toBe("2026-09-28");
  });

  it("riepilogo della settimana", () => {
    const w = (day: string, minutes: number): Workout => ({ id: day + minutes, day, at: `${day}T10:00:00Z`, type: "walking", minutes, intensity: 2 });
    const list = [w("2026-09-27", 60), w("2026-09-28", 30), w("2026-10-02", 45), w("2026-10-02", 15)];
    expect(weekSummary(list, null, "2026-10-04")).toEqual({ sessions: 3, minutes: 90, kcal: null, activeDays: 2 });
    // Camminata media (3,8 MET) a 60 kg: 114 + 171 + 57; quella del 27 settembre è della settimana prima.
    expect(weekSummary(list, 60, "2026-10-04").kcal).toBe(342);
  });
});

describe("conta-calorie", () => {
  it("tolleranza kcal/macro: 20% o 10 kcal", () => {
    expect(kcalConsistent(100, 10, 10, 2.2)).toBe(true); // 100 da macro
    expect(kcalConsistent(119, 10, 10, 2.2)).toBe(true);
    expect(kcalConsistent(125, 10, 10, 2.2)).toBe(false);
    expect(kcalConsistent(18, 2, 0, 0)).toBe(true); // 8 kcal: vale la soglia di 10
    expect(kcalConsistent(20, 2, 0, 0)).toBe(false);
    expect(kcalConsistent(300)).toBe(true); // senza macro non si controlla
  });

  const e = (name: string, at: string, kcal: number, protein?: number): FoodEntry => ({
    id: name + at,
    day: at.slice(0, 10),
    at,
    meal: "lunch",
    name,
    kcal,
    protein,
  });

  it("totali del giorno", () => {
    expect(totals([e("Pasta", "2026-10-04T12:00:00Z", 350, 12), e("Mela", "2026-10-04T16:00:00Z", 52)])).toEqual({
      kcal: 402,
      protein: 12,
      carbs: 0,
      fat: 0,
    });
  });

  it("alimenti recenti: uno per nome, dal più recente", () => {
    const list = [e("Pasta", "2026-10-01T12:00:00Z", 350), e("Mela", "2026-10-02T12:00:00Z", 52), e("pasta ", "2026-10-03T12:00:00Z", 400)];
    expect(recentFoods(list).map((f) => f.kcal)).toEqual([400, 52]);
  });

  it("pasto suggerito dall'ora", () => {
    expect(mealForHour(8)).toBe("breakfast");
    expect(mealForHour(13)).toBe("lunch");
    expect(mealForHour(16)).toBe("snack");
    expect(mealForHour(20)).toBe("dinner");
    expect(mealForHour(2)).toBe("snack");
  });
});

describe("date", () => {
  it("daysBetween attraversa l'ora legale", () => {
    expect(daysBetween("2026-10-20", "2026-10-30")).toBe(10);
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
    expect(daysBetween("2026-10-04", "2026-10-01")).toBe(-3);
  });
});

describe("nome nel saluto", () => {
  it("toglie gli spazi in più e taglia a 16 caratteri", () => {
    expect(cleanName("  Anna   Maria ")).toBe("Anna Maria");
    expect(cleanName("Bartolomeo Massimiliano")).toBe("Bartolomeo Massi");
    expect(cleanName("   ")).toBeUndefined();
  });

  it("le emoji non vengono spezzate e il profilo resta valido", () => {
    const name = cleanName("Giulia 🌙🌙🌙🌙🌙")!;
    expect(name).toBe("Giulia 🌙🌙🌙🌙");
    expect(name.length).toBeLessThanOrEqual(16);
    expect(profileSchema.safeParse({ displayName: name }).success).toBe(true);
  });
});
