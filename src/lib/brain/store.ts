"use client";

import { z } from "zod";
import { localDateKey } from "@/lib/dates";
import { defineStore } from "@/lib/storage/local-store";
import { type BrainResult, MAX_STORED_RESULTS, brainResultSchema } from "./history";

const EMPTY: BrainResult[] = [];

export const brainResults = defineStore("brain-results", z.array(brainResultSchema), EMPTY);

export function saveBrainResult(input: Omit<BrainResult, "id" | "at" | "day">): BrainResult {
  const now = new Date();
  const result: BrainResult = { ...input, id: crypto.randomUUID(), at: now.toISOString(), day: localDateKey(now) };
  brainResults.set((prev) => [...prev, result].slice(-MAX_STORED_RESULTS));
  return result;
}
