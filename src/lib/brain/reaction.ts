import { type Rng, randInt } from "@/lib/random";
import { mean, median } from "./stats";

export const REACTION_TRIALS = 5;
const REACTION_DELAY_MS = [1500, 4000] as const;
// Sotto i 100 ms non è una reazione allo stimolo ma un anticipo: conta come partenza falsa.
const MIN_HUMAN_REACTION_MS = 100;

export function randomDelay(rng: Rng): number {
  return randInt(rng, REACTION_DELAY_MS[0], REACTION_DELAY_MS[1]);
}

export function isAnticipation(ms: number): boolean {
  return ms < MIN_HUMAN_REACTION_MS;
}

export type ReactionSummary = { median: number; mean: number; best: number; worst: number };

export function summarizeReaction(times: readonly number[]): ReactionSummary {
  return {
    median: Math.round(median(times)),
    mean: Math.round(mean(times)),
    best: Math.round(Math.min(...times)),
    worst: Math.round(Math.max(...times)),
  };
}
