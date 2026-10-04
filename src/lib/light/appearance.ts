"use client";

import { z } from "zod";
import { defineStore } from "@/lib/storage/local-store";
import { BACKGROUNDS, DEFAULT_BACKGROUND } from "./backgrounds";
import { DEFAULT_MOTION_LEVEL } from "./motion";

const schema = z.object({
  background: z.enum(BACKGROUNDS),
  // Livello di animazione 0..100 (aggiunto dopo: chi l'aveva salvato senza riceve il default).
  motion: z.number().int().min(0).max(100).default(DEFAULT_MOTION_LEVEL),
});
export type Appearance = z.infer<typeof schema>;

const DEFAULTS: Appearance = { background: DEFAULT_BACKGROUND, motion: DEFAULT_MOTION_LEVEL };

export const appearance = defineStore("appearance", schema, DEFAULTS);
