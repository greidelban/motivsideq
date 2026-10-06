import * as z from "zod/mini";
import { describe, expect, it } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { bestOf, estimated1rm, exerciseHistory, exerciseKey, newRecords, searchExercises, setSchema, totalSets, volumeKg } from "./exercises";
import { distanceMode, hasExercises, paceOrSpeed, workoutSchema } from "./workouts";

const workout = (id: string, day: string, exercises: { exercise: string; name?: string; sets: { reps?: number; kg?: number; seconds?: number }[] }[]) => ({
  id,
  day,
  at: `${day}T18:00:00.000Z`,
  exercises,
});

describe("serie e massimali", () => {
  it("massimale stimato (Epley) fino a 12 ripetizioni", () => {
    expect(estimated1rm({ reps: 1, kg: 100 })).toBe(100);
    expect(estimated1rm({ reps: 5, kg: 80 })).toBe(93.3);
    expect(estimated1rm({ reps: 15, kg: 50 })).toBeNull();
    expect(estimated1rm({ reps: 10 })).toBeNull();
  });

  it("il meglio di un elenco ignora le serie vuote", () => {
    expect(bestOf([{ reps: 5, kg: 80 }, { reps: 8, kg: 70 }, { kg: 200 }])).toEqual({ kg: 80, e1rm: 93.3, reps: 8, seconds: null });
    expect(bestOf([{ seconds: 45 }, { seconds: 60 }])).toEqual({ kg: null, e1rm: null, reps: null, seconds: 60 });
  });

  it("volume e numero di serie", () => {
    const ex = [{ exercise: "squat", sets: [{ reps: 5, kg: 100 }, { reps: 5, kg: 100 }, { kg: 100 }] }];
    expect(volumeKg(ex)).toBe(1000);
    expect(totalSets(ex)).toBe(2);
  });

  it("schema: ripetizioni intere, peso entro i limiti", () => {
    expect(z.safeParse(setSchema, { reps: 8, kg: 62.5 }).success).toBe(true);
    expect(z.safeParse(setSchema, { reps: 2.5 }).success).toBe(false);
    expect(z.safeParse(setSchema, { reps: 5, kg: 2000 }).success).toBe(false);
  });

  it("gli allenamenti vecchi (senza esercizi) restano validi", () => {
    const old = { id: "a", day: "2026-10-01", at: "2026-10-01T18:00:00Z", type: "gym", minutes: 45, intensity: 2 };
    expect(z.safeParse(workoutSchema, old).success).toBe(true);
    expect(z.safeParse(workoutSchema, { ...old, exercises: [{ exercise: "squat", sets: [{ reps: 5, kg: 100 }] }], distanceKm: 5 }).success).toBe(true);
  });
});

describe("storico e record", () => {
  const history = [
    workout("1", "2026-10-01", [{ exercise: "benchPress", sets: [{ reps: 5, kg: 70 }] }, { exercise: "pullUp", sets: [{ reps: 6 }] }]),
    workout("2", "2026-10-03", [{ exercise: "benchPress", sets: [{ reps: 5, kg: 72.5 }, { reps: 3, kg: 75 }] }]),
    workout("3", "2026-10-02", [{ exercise: "custom", name: "Panca Larsen ", sets: [{ reps: 8, kg: 50 }] }]),
  ];

  it("ultima volta e meglio di sempre per esercizio", () => {
    const h = exerciseHistory(history);
    const bench = h.find((x) => x.key === "benchPress")!;
    expect(bench.lastDay).toBe("2026-10-03");
    expect(bench.sessions).toBe(2);
    expect(bench.best.kg).toBe(75);
    expect(bench.best.e1rm).toBe(84.6);
    expect(h[0].key).toBe("benchPress");
    expect(h.map((x) => x.key)).toContain("custom:panca larsen");
  });

  it("stesso nome scritto in modo diverso = stesso esercizio", () => {
    expect(exerciseKey({ exercise: "custom", name: "  PANCA larsen" })).toBe(exerciseKey({ exercise: "custom", name: "panca Larsen" }));
  });

  it("record: massimale stimato, ripetizioni a corpo libero; la prima volta no", () => {
    const today = workout("4", "2026-10-05", [
      { exercise: "benchPress", sets: [{ reps: 5, kg: 77.5 }] },
      { exercise: "pullUp", sets: [{ reps: 8 }] },
      { exercise: "squat", sets: [{ reps: 5, kg: 100 }] },
    ]);
    const records = newRecords(today, history);
    expect(records.map((r) => [r.key, r.kind, r.value])).toEqual([
      ["benchPress", "e1rm", 90.4],
      ["pullUp", "reps", 8],
    ]);
  });

  it("l'allenamento si confronta con gli altri, non con sé stesso", () => {
    // Il "2" rivisto con 5×70: senza sé stesso il meglio è quello del "1" (5×70), quindi niente record.
    const edited = workout("2", "2026-10-03", [{ exercise: "benchPress", sets: [{ reps: 5, kg: 70 }] }]);
    expect(newRecords(edited, history)).toEqual([]);
    // Con 5×72,5 invece batte il "1".
    const better = workout("2", "2026-10-03", [{ exercise: "benchPress", sets: [{ reps: 5, kg: 72.5 }] }]);
    expect(newRecords(better, history).map((r) => r.kind)).toEqual(["e1rm"]);
  });
});

describe("ricerca degli esercizi", () => {
  it("prima i nomi che iniziano con il testo", () => {
    const ids = searchExercises(en.health.training.exercises, "press");
    expect(ids[0]).toBe("legPress");
    expect(ids).toContain("benchPress");
    expect(searchExercises(en.health.training.exercises, " ")).toEqual([]);
  });
});

describe("distanza", () => {
  it("passo per corsa e camminata, velocità per la bici", () => {
    expect(paceOrSpeed("running", 25, 5)).toEqual({ kind: "pace", secondsPerKm: 300 });
    expect(paceOrSpeed("cycling", 90, 45)).toEqual({ kind: "speed", kmh: 30 });
    expect(paceOrSpeed("running", 25, undefined)).toBeNull();
    expect(paceOrSpeed("yoga", 25, 5)).toBeNull();
  });

  it("quali tipi hanno esercizi o distanza", () => {
    expect(hasExercises("gym")).toBe(true);
    expect(hasExercises("running")).toBe(false);
    expect(distanceMode("swimming")).toBe("pace");
    expect(distanceMode("gym")).toBeNull();
  });
});

describe("dal modulo ai dati", async () => {
  const { distanceFromForm, exercisesFromForm, formatPace } = await import("./workout-form");
  const set = (reps: string, weight = "", seconds = "") => ({ reps, weight, seconds });

  it("serie vuote tolte, virgola accettata, libbre in kg", () => {
    const logs = exercisesFromForm(
      [
        { exercise: "squat", sets: [set("5", "100"), set("5", "102,5"), set("", "100")] },
        { exercise: "pullUp", sets: [set("8")] },
        { exercise: "plank", sets: [set("", "", "60")] },
        { exercise: "benchPress", sets: [set("")] },
        { exercise: "custom", name: "  ", sets: [set("10")] },
        { exercise: "custom", name: " Panca Larsen ", sets: [set("8", "135")] },
      ],
      "lb",
    );
    expect(logs).toEqual([
      { exercise: "squat", sets: [{ reps: 5, kg: 45.4 }, { reps: 5, kg: 46.5 }] },
      { exercise: "pullUp", sets: [{ reps: 8 }] },
      { exercise: "plank", sets: [{ seconds: 60 }] },
      { exercise: "custom", name: "Panca Larsen", sets: [{ reps: 8, kg: 61.2 }] },
    ]);
  });

  it("ripetizioni non intere rifiutate", () => {
    expect(exercisesFromForm([{ exercise: "squat", sets: [set("5.5", "100")] }], "kg")).toEqual([]);
  });

  it("distanza e passo", () => {
    expect(distanceFromForm("10,5")).toBe(10.5);
    expect(distanceFromForm("")).toBeUndefined();
    expect(distanceFromForm("0")).toBeUndefined();
    expect(formatPace(307)).toBe("5:07");
  });
});
