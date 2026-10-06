import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import type { CheckIn } from "@/lib/journal/journal";
import { comparePair, computeInsights, hasAnyInsight } from "./insights";

const today = "2026-10-06"; // martedì
const day = (n: number) => addDays(today, -n);
const base = { workouts: [], brainResults: [], periods: null, pages: [], today, days: 30 };

describe("confronto tra due gruppi", () => {
  it("serve un minimo di giorni per lato", () => {
    expect(comparePair([4, 4], [3, 3, 3])).toBeNull();
    expect(comparePair([4, 4, 5], [3, 3, 3])).toEqual({ a: 4.3, b: 3, daysA: 3, daysB: 3, direction: "higher" });
  });

  it("differenze piccole = più o meno uguale", () => {
    expect(comparePair([3, 3, 4], [3, 3, 3.5])?.direction).toBe("same");
    expect(comparePair([2, 2, 2], [4, 4, 4])?.direction).toBe("lower");
  });
});

describe("Giorgio: sonno, allenamento e riflessi", () => {
  // Due settimane: notti piene (8 h) nei giorni pari, corte (5,5 h) nei dispari;
  // umore ed energia più alti dopo le notti piene; allenamento ogni 3 giorni.
  const checkIns: CheckIn[] = Array.from({ length: 14 }, (_, i) => ({
    day: day(i),
    sleepHours: i % 2 === 0 ? 8 : 5.5,
    mood: i % 2 === 0 ? 4 : 3,
    energy: i % 3 === 0 ? 5 : 3,
  }));
  const workouts = Array.from({ length: 14 }, (_, i) => i)
    .filter((i) => i % 3 === 0)
    .map((i) => ({ day: day(i) }));
  const brainResults = Array.from({ length: 14 }, (_, i) => ({ day: day(i), game: "reaction", score: i % 2 === 0 ? 280 : 320, routine: i < 5 }));
  const insights = computeInsights({ ...base, checkIns, workouts, brainResults });

  it("umore più alto dopo le notti piene", () => {
    expect(insights.sleep.mood).toEqual({ a: 4, b: 3, daysA: 7, daysB: 7, direction: "higher" });
  });

  it("energia più alta nei giorni di allenamento", () => {
    expect(insights.training.energy?.direction).toBe("higher");
    expect(insights.training.energy?.daysA).toBe(5);
  });

  it("riflessi più rapidi del 12,5% dopo le notti piene", () => {
    expect(insights.reaction).toMatchObject({ a: 280, b: 320, direction: "higher" });
    expect(insights.reaction?.change).toBeCloseTo(0.125);
  });

  it("riepilogo del periodo", () => {
    expect(insights.summary).toEqual({ checkIns: 14, pages: 0, workouts: 5, trainingDays: 5, wakeUps: 5 });
    expect(insights.cycle).toBeNull();
    expect(hasAnyInsight(insights)).toBe(true);
  });

  it("i giorni fuori dal periodo non contano", () => {
    const old = computeInsights({ ...base, checkIns: checkIns.map((c) => ({ ...c, day: addDays(c.day, -60) })) });
    expect(old.summary.checkIns).toBe(0);
    expect(hasAnyInsight(old)).toBe(false);
  });
});

describe("Marta: ciclo e giorno migliore", () => {
  // Mestruazioni dal 21 al 25 settembre: umore 2 in quei giorni, 4 negli altri.
  const periods = [{ id: "p1", start: "2026-09-21", end: "2026-09-25" }];
  const checkIns: CheckIn[] = Array.from({ length: 20 }, (_, i) => {
    const d = day(i);
    const during = d >= "2026-09-21" && d <= "2026-09-25";
    return { day: d, mood: during ? 2 : 4, energy: during ? 2 : 4 };
  });

  it("umore più basso durante le mestruazioni (solo col Ciclo attivo)", () => {
    const withCycle = computeInsights({ ...base, checkIns, periods });
    expect(withCycle.cycle?.mood).toMatchObject({ a: 2, b: 4, daysA: 5, daysB: 15, direction: "lower" });
    expect(computeInsights({ ...base, checkIns, periods: null }).cycle).toBeNull();
  });

  it("giorno migliore: solo se si stacca dalla media", () => {
    // Il martedì (oggi e 7, 14 giorni fa) ha umore 5, gli altri giorni 3.
    const tuesdays: CheckIn[] = Array.from({ length: 21 }, (_, i) => ({ day: day(i), mood: i % 7 === 0 ? 5 : 3 }));
    expect(computeInsights({ ...base, checkIns: tuesdays }).bestWeekday).toEqual({ weekday: 2, mood: 5 });
    const flat: CheckIn[] = Array.from({ length: 21 }, (_, i) => ({ day: day(i), mood: 3 }));
    expect(computeInsights({ ...base, checkIns: flat }).bestWeekday).toBeNull();
  });
});

describe("storico di prova di Giorgio e Marta", async () => {
  const { personaHistory } = await import("@/lib/dev/personas");

  it("dà collegamenti nella direzione attesa", () => {
    for (const id of ["giorgio", "marta"] as const) {
      const h = personaHistory(id, today, 45);
      const i = computeInsights({ ...base, days: 90, checkIns: h.checkIns, workouts: h.workouts, brainResults: h.reactions.map((r) => ({ ...r, game: "reaction", routine: false })), periods: h.periods.length ? h.periods : null });
      expect(i.sleep.mood?.direction, id).toBe("higher");
      expect(i.reaction?.direction, id).toBe("higher");
      if (id === "marta") expect(i.cycle?.mood?.direction).toBe("lower");
    }
  });
});
