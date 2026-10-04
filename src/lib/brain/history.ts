import * as z from "zod/mini";
import { streak } from "@/lib/dates";
import { GAME_IDS, GAMES, type GameId, LEGACY_GAME_IDS } from "./games";
import { type Comparison, bestOf, compareToBaseline, isPersonalBest } from "./stats";

export const brainResultSchema = z.object({
  id: z.string().check(z.maxLength(64)),
  // I risultati salvati con i nomi italiani della prima versione vengono convertiti.
  game: z.pipe(
    z.transform((v: unknown) => (typeof v === "string" && Object.hasOwn(LEGACY_GAME_IDS, v) ? LEGACY_GAME_IDS[v] : v)),
    z.enum(GAME_IDS),
  ),
  /** Impostazioni della prova (es. "classic-60"): si confrontano solo prove uguali. */
  variant: z.string().check(z.maxLength(40)),
  at: z.string().check(z.maxLength(40)),
  /** Giorno locale AAAA-MM-GG. */
  day: z.string().check(z.maxLength(10)),
  score: z.number(),
  metrics: z.record(z.string().check(z.maxLength(30)), z.number()),
  routine: z.boolean(),
});

export type BrainResult = z.infer<typeof brainResultSchema>;

export const MAX_STORED_RESULTS = 3000;

export function resultsFor(results: readonly BrainResult[], game: GameId, variant?: string): BrainResult[] {
  return results.filter((r) => r.game === game && (variant === undefined || r.variant === variant));
}

export type ResultVerdict = {
  comparison: Comparison | null;
  personalBest: boolean;
  best: number | null;
};

/** Valuta un nuovo risultato rispetto ai precedenti con le stesse impostazioni. */
export function judgeResult(previous: readonly BrainResult[], result: Pick<BrainResult, "game" | "variant" | "score">): ResultVerdict {
  const { better } = GAMES[result.game];
  const scores = resultsFor(previous, result.game, result.variant).map((r) => r.score);
  return {
    comparison: compareToBaseline(scores, result.score, better),
    personalBest: isPersonalBest(scores, result.score, better),
    best: bestOf([...scores, result.score], better),
  };
}

/** Giorni consecutivi in cui è stata completata la routine del risveglio. */
export function routineStreak(results: readonly BrainResult[], today?: string): number {
  return streak(
    results.filter((r) => r.routine).map((r) => r.day),
    today,
  );
}

export function routineDoneOn(results: readonly BrainResult[], day: string): boolean {
  return results.some((r) => r.routine && r.day === day);
}
