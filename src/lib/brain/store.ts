"use client";

import { localDateKey } from "@/lib/dates";
import { localDb } from "@/lib/storage/db";
import { DEFS } from "@/lib/storage/definitions";
import { type BrainResult, MAX_STORED_RESULTS } from "./history";

export const brainResults = localDb.store(DEFS.brainResults);

export function saveBrainResult(input: Omit<BrainResult, "id" | "at" | "day">): BrainResult {
  const now = new Date();
  const result: BrainResult = { ...input, id: crypto.randomUUID(), at: now.toISOString(), day: localDateKey(now) };
  brainResults.set((prev) => [...prev, result].slice(-MAX_STORED_RESULTS));
  return result;
}
