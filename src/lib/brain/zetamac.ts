import { type Rng, pick, randInt } from "@/lib/random";
import { mean } from "./stats";

// Calcolo rapido, sulle regole di Zetamac: addizioni, sottrazioni (addizioni al
// contrario), moltiplicazioni e divisioni (moltiplicazioni al contrario).
// Risultati sempre interi e non negativi; si passa al successivo appena la
// risposta è giusta, senza premere invio.

type Range = readonly [number, number];

export const ZETAMAC_LEVELS = {
  classic: { add: [[2, 100], [2, 100]], mul: [[2, 12], [2, 100]] },
  light: { add: [[2, 20], [2, 20]], mul: [[2, 10], [2, 10]] },
} as const satisfies Record<string, { add: readonly [Range, Range]; mul: readonly [Range, Range] }>;

export type ZetamacLevel = keyof typeof ZETAMAC_LEVELS;
export const ZETAMAC_DURATIONS = [60, 120] as const;
export type ZetamacDuration = (typeof ZETAMAC_DURATIONS)[number];

export const OPERATIONS = ["+", "−", "×", "÷"] as const;
export type Operation = (typeof OPERATIONS)[number];
export type Problem = { a: number; b: number; op: Operation; answer: number };

export function generateProblem(rng: Rng, level: ZetamacLevel, previous?: Problem): Problem {
  const { add, mul } = ZETAMAC_LEVELS[level];
  for (;;) {
    const op = pick(rng, OPERATIONS);
    let p: Problem;
    if (op === "+" || op === "−") {
      const x = randInt(rng, add[0][0], add[0][1]);
      const y = randInt(rng, add[1][0], add[1][1]);
      p = op === "+" ? { a: x, b: y, op, answer: x + y } : { a: x + y, b: x, op, answer: y };
    } else {
      const x = randInt(rng, mul[0][0], mul[0][1]);
      const y = randInt(rng, mul[1][0], mul[1][1]);
      p = op === "×" ? { a: x, b: y, op, answer: x * y } : { a: x * y, b: x, op, answer: y };
    }
    // Mai lo stesso problema due volte di fila.
    if (!previous || p.a !== previous.a || p.b !== previous.b || p.op !== previous.op) return p;
  }
}

export function problemText(p: Problem): string {
  return `${p.a} ${p.op} ${p.b}`;
}

export function isCorrectAnswer(input: string, p: Problem): boolean {
  return input !== "" && input === String(p.answer);
}

/** Risposte giuste al minuto: rende confrontabili le prove da 60 e da 120 secondi. */
export function zetamacRate(correct: number, durationSec: number): number {
  return Math.round((correct * 60 * 10) / durationSec) / 10;
}

export function zetamacVariant(level: ZetamacLevel, duration: ZetamacDuration): string {
  return `${level}-${duration}`;
}

// ---- Tempi di risposta -------------------------------------------------------

/** Una risposta giusta e quanto ci è voluto (dalla comparsa del problema). */
export type TimedAnswer = { op: Operation; ms: number };

// Chiavi con cui i tempi medi per operazione finiscono nelle metriche salvate.
export const OP_METRIC_KEYS: Record<Operation, string> = {
  "+": "avgAddMs",
  "−": "avgSubMs",
  "×": "avgMulMs",
  "÷": "avgDivMs",
};

export type AnswerTimes = {
  avgMs: number;
  fastestMs: number;
  slowestMs: number;
  /** Tempo medio per tipo di operazione (solo quelle comparse). */
  byOp: Partial<Record<Operation, number>>;
};

export function summarizeAnswerTimes(answers: readonly TimedAnswer[]): AnswerTimes | null {
  if (answers.length === 0) return null;
  const ms = answers.map((a) => a.ms);
  const byOp: Partial<Record<Operation, number>> = {};
  for (const op of OPERATIONS) {
    const times = answers.filter((a) => a.op === op).map((a) => a.ms);
    if (times.length) byOp[op] = Math.round(mean(times));
  }
  return {
    avgMs: Math.round(mean(ms)),
    fastestMs: Math.round(Math.min(...ms)),
    slowestMs: Math.round(Math.max(...ms)),
    byOp,
  };
}

/** Metriche da salvare: totali più i tempi (piatti, perché le metriche sono numeri). */
export function mathMetrics(correct: number, durationSec: number, answers: readonly TimedAnswer[]): Record<string, number> {
  const metrics: Record<string, number> = { correct, durationSec };
  const times = summarizeAnswerTimes(answers);
  if (!times) return metrics;
  metrics.avgMs = times.avgMs;
  metrics.fastestMs = times.fastestMs;
  metrics.slowestMs = times.slowestMs;
  for (const op of OPERATIONS) {
    const v = times.byOp[op];
    if (v !== undefined) metrics[OP_METRIC_KEYS[op]] = v;
  }
  return metrics;
}
