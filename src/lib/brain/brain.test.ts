import { describe, expect, it } from "vitest";
import { seededRng } from "@/lib/random";
import { type BrainResult, brainResultSchema, judgeResult, routineDoneOn, routineStreak } from "./history";
import { isAnticipation, randomDelay, summarizeReaction } from "./reaction";
import { generateSchulteGrid, schulteSeconds } from "./schulte";
import { compareToBaseline, isPersonalBest, median } from "./stats";
import { generateStroopTrial, summarizeStroop } from "./stroop";
import {
  ZETAMAC_LEVELS,
  generateProblem,
  isCorrectAnswer,
  mathMetrics,
  problemText,
  summarizeAnswerTimes,
  zetamacRate,
} from "./zetamac";

describe("stats", () => {
  it("median", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNaN();
  });

  it("compareToBaseline: serve uno storico minimo", () => {
    expect(compareToBaseline([300, 310], 280, "lower")).toBeNull();
  });

  it("compareToBaseline: il segno indica sempre 'meglio'", () => {
    // Tempo di reazione: più basso è meglio.
    expect(compareToBaseline([300, 300, 300], 270, "lower")?.improvement).toBeCloseTo(0.1);
    // Calcolo: più alto è meglio.
    expect(compareToBaseline([30, 30, 30], 27, "higher")?.improvement).toBeCloseTo(-0.1);
  });

  it("compareToBaseline usa solo gli ultimi risultati", () => {
    const old = Array(20).fill(500);
    const recent = Array(10).fill(300);
    expect(compareToBaseline([...old, ...recent], 300, "lower")?.baseline).toBe(300);
  });

  it("isPersonalBest: mai al primo tentativo", () => {
    expect(isPersonalBest([], 200, "lower")).toBe(false);
    expect(isPersonalBest([250, 230], 220, "lower")).toBe(true);
    expect(isPersonalBest([25, 30], 30, "higher")).toBe(false);
  });
});

describe("calcolo rapido (Zetamac)", () => {
  it("genera problemi con risultati interi, non negativi e nei limiti", () => {
    const rng = seededRng(42);
    const { add, mul } = ZETAMAC_LEVELS.classic;
    let prev;
    for (let i = 0; i < 2000; i++) {
      const p = generateProblem(rng, "classic", prev);
      expect(Number.isInteger(p.answer)).toBe(true);
      expect(p.answer).toBeGreaterThanOrEqual(0);
      if (p.op === "+") expect(p.answer).toBe(p.a + p.b);
      if (p.op === "−") expect(p.answer).toBe(p.a - p.b);
      if (p.op === "×") {
        expect(p.a).toBeGreaterThanOrEqual(mul[0][0]);
        expect(p.a).toBeLessThanOrEqual(mul[0][1]);
        expect(p.answer).toBe(p.a * p.b);
      }
      if (p.op === "÷") expect(p.a / p.b).toBe(p.answer);
      if (p.op === "+") expect(p.b).toBeLessThanOrEqual(add[1][1]);
      if (prev) expect(problemText(p)).not.toBe(problemText(prev));
      prev = p;
    }
  });

  it("usa tutte e quattro le operazioni", () => {
    const rng = seededRng(7);
    const ops = new Set(Array.from({ length: 200 }, () => generateProblem(rng, "light").op));
    expect(ops).toEqual(new Set(["+", "−", "×", "÷"]));
  });

  it("riconosce la risposta esatta", () => {
    const p = { a: 7, b: 8, op: "×" as const, answer: 56 };
    expect(isCorrectAnswer("56", p)).toBe(true);
    expect(isCorrectAnswer("5", p)).toBe(false);
    expect(isCorrectAnswer("", p)).toBe(false);
    expect(isCorrectAnswer("056", p)).toBe(false);
  });

  it("rende confrontabili 60 e 120 secondi", () => {
    expect(zetamacRate(30, 60)).toBe(30);
    expect(zetamacRate(45, 120)).toBe(22.5);
  });
});

describe("tempi di risposta del calcolo", () => {
  const answers = [
    { op: "+" as const, ms: 900 },
    { op: "+" as const, ms: 1100 },
    { op: "×" as const, ms: 2000 },
    { op: "÷" as const, ms: 2600.4 },
  ];

  it("media, più veloce, più lenta e media per operazione", () => {
    expect(summarizeAnswerTimes(answers)).toEqual({
      avgMs: 1650,
      fastestMs: 900,
      slowestMs: 2600,
      byOp: { "+": 1000, "×": 2000, "÷": 2600 },
    });
  });

  it("senza risposte non c'è niente da riassumere", () => {
    expect(summarizeAnswerTimes([])).toBeNull();
    expect(mathMetrics(0, 60, [])).toEqual({ correct: 0, durationSec: 60 });
  });

  it("le metriche salvate includono solo le operazioni comparse", () => {
    expect(mathMetrics(4, 60, answers)).toEqual({
      correct: 4,
      durationSec: 60,
      avgMs: 1650,
      fastestMs: 900,
      slowestMs: 2600,
      avgAddMs: 1000,
      avgMulMs: 2000,
      avgDivMs: 2600,
    });
  });
});

describe("reazione", () => {
  it("attesa casuale tra 1,5 e 4 secondi", () => {
    const rng = seededRng(1);
    for (let i = 0; i < 500; i++) {
      const d = randomDelay(rng);
      expect(d).toBeGreaterThanOrEqual(1500);
      expect(d).toBeLessThanOrEqual(4000);
    }
  });

  it("sotto i 100 ms è un anticipo", () => {
    expect(isAnticipation(80)).toBe(true);
    expect(isAnticipation(180)).toBe(false);
  });

  it("riassume le prove", () => {
    expect(summarizeReaction([250, 300, 280, 260, 400])).toEqual({ median: 280, mean: 298, best: 250, worst: 400 });
  });
});

describe("colori (Stroop)", () => {
  it("rispetta la quota di prove incongruenti", () => {
    const rng = seededRng(3);
    let prev;
    let incongruent = 0;
    for (let i = 0; i < 4000; i++) {
      const t = generateStroopTrial(rng, prev);
      if (t.word !== t.ink) incongruent++;
      prev = t;
    }
    expect(incongruent / 4000).toBeGreaterThan(0.7);
    expect(incongruent / 4000).toBeLessThan(0.85);
  });

  it("il punteggio usa solo le risposte giuste", () => {
    expect(
      summarizeStroop([
        { correct: true, ms: 600 },
        { correct: true, ms: 800 },
        { correct: false, ms: 300 },
      ]),
    ).toEqual({ avgMs: 700, fastestMs: 600, slowestMs: 800, accuracy: 67, errors: 1 });
    expect(summarizeStroop([{ correct: false, ms: 500 }]).avgMs).toBeNull();
  });
});

describe("tabella di Schulte", () => {
  it("contiene ogni numero da 1 a 25 una volta", () => {
    const grid = generateSchulteGrid(seededRng(9));
    expect([...grid].sort((a, b) => a - b)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
  });

  it("arrotonda ai decimi di secondo", () => {
    expect(schulteSeconds(23456)).toBe(23.5);
  });
});

describe("storico", () => {
  const r = (over: Partial<BrainResult>): BrainResult => ({
    id: Math.random().toString(),
    game: "reaction",
    variant: "5",
    at: "",
    day: "2026-10-03",
    score: 300,
    metrics: {},
    routine: false,
    ...over,
  });

  it("confronta solo prove con le stesse impostazioni", () => {
    const history = [
      r({ game: "math", variant: "classic-60", score: 20 }),
      r({ game: "math", variant: "classic-60", score: 22 }),
      r({ game: "math", variant: "classic-60", score: 24 }),
      r({ game: "math", variant: "light-60", score: 60 }),
    ];
    const v = judgeResult(history, { game: "math", variant: "classic-60", score: 25 });
    expect(v.personalBest).toBe(true);
    expect(v.comparison?.baseline).toBe(22);
    expect(v.best).toBe(25);
  });

  it("converte i nomi italiani dei giochi salvati dalla prima versione", () => {
    const old = { ...r({}), game: "calcolo" };
    expect(brainResultSchema.parse(old).game).toBe("math");
    expect(brainResultSchema.safeParse({ ...r({}), game: "toString" }).success).toBe(false);
  });

  it("serie della routine del risveglio", () => {
    const history = [
      r({ routine: true, day: "2026-10-01" }),
      r({ routine: true, day: "2026-10-02" }),
      r({ routine: false, day: "2026-10-03" }),
    ];
    expect(routineStreak(history, "2026-10-03")).toBe(2);
    expect(routineDoneOn(history, "2026-10-03")).toBe(false);
    expect(routineDoneOn(history, "2026-10-02")).toBe(true);
  });
});
