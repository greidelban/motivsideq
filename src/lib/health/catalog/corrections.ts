import * as z from "zod/mini";
import { kcalConsistent } from "../food";
import type { CatalogFood } from "./foods";

// Correzioni dalla comunità (logica pura). Chi ha un account con email
// verificata manda i valori giusti per 100 g/ml; il server raccoglie quelli di
// tutti e restituisce la mediana degli alimenti con almeno MIN_VOTES persone
// (supabase/migrations/20261006090000_food_corrections.sql).

/** Uguale a quello del database (food_consensus). */
const MIN_VOTES = 5;
export const KJ_PER_KCAL = 4.184;
/** Ogni quanto si riscaricano i valori della comunità. */
const REFRESH_MS = 24 * 60 * 60 * 1000;

const value = (max: number) => z.number().check(z.gte(0), z.lte(max));

const consensusItemSchema = z.object({
  foodId: z.string().check(z.maxLength(64)),
  votes: z.int().check(z.gte(MIN_VOTES)),
  kcal: value(900),
  protein: value(100),
  carbs: value(100),
  fat: value(100),
});
export type ConsensusItem = z.infer<typeof consensusItemSchema>;

export const consensusSchema = z.object({
  fetchedAt: z.string().check(z.maxLength(40)),
  items: z.array(consensusItemSchema).check(z.maxLength(5000)),
});
export type Consensus = z.infer<typeof consensusSchema>;

export const EMPTY_CONSENSUS: Consensus = { fetchedAt: "", items: [] };

export function needsRefresh(consensus: Consensus, now: Date = new Date()): boolean {
  const at = Date.parse(consensus.fetchedAt);
  return !Number.isFinite(at) || now.getTime() - at > REFRESH_MS || at > now.getTime();
}

/** Righe arrivate dal server → elenco controllato (le righe strane si scartano). */
export function parseConsensusRows(rows: unknown, now: Date = new Date()): Consensus {
  const items: ConsensusItem[] = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const parsed = z.safeParse(consensusItemSchema, {
      foodId: r.food_id,
      votes: Number(r.votes),
      kcal: Number(r.kcal),
      protein: Number(r.protein),
      carbs: Number(r.carbs),
      fat: Number(r.fat),
    });
    if (parsed.success) items.push(parsed.data);
  }
  return { fetchedAt: now.toISOString(), items };
}

/** L'alimento con i valori della comunità, se ci sono (votes = null: valori della tabella). */
export function withConsensus(food: CatalogFood, items: readonly ConsensusItem[]): { food: CatalogFood; votes: number | null } {
  const item = items.find((i) => i.foodId === food.id);
  if (!item) return { food, votes: null };
  const { kcal, protein, carbs, fat, votes } = item;
  return { food: { ...food, kcal, protein, carbs, fat }, votes };
}

/** Le bevande alcoliche non si correggono: le loro kcal dipendono anche dall'alcol. */
export const canCorrect = (food: CatalogFood) => !food.alcohol;

export const toKcal = (energy: number, unit: "kcal" | "kJ") => (unit === "kJ" ? energy / KJ_PER_KCAL : energy);

export type CorrectionInput = { kcal: number; protein: number; carbs: number; fat: number };

/** Stesse regole del database: valori presenti e plausibili, kcal coerenti con i macro. */
export function checkCorrection(v: CorrectionInput): "ok" | "invalid" | "inconsistent" {
  const fields = [v.protein, v.carbs, v.fat];
  if (![v.kcal, ...fields].every(Number.isFinite)) return "invalid";
  if (v.kcal < 0 || v.kcal > 900 || fields.some((g) => g < 0 || g > 100)) return "invalid";
  if (v.protein + v.carbs + v.fat > 100) return "invalid";
  return kcalConsistent(v.kcal, v.protein, v.carbs, v.fat) ? "ok" : "inconsistent";
}
