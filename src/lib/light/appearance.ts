"use client";

import * as z from "zod/mini";
import { defineStore } from "@/lib/storage/local-store";
import { BACKGROUNDS, type BackgroundId, DEFAULT_BACKGROUND } from "./backgrounds";
import { DEFAULT_MOTION_LEVEL } from "./motion";
import { PALETTE_IDS, type PaletteId } from "./palettes";

const schema = z.object({
  background: z.enum(BACKGROUNDS),
  // Livello di animazione 0..100 (aggiunto dopo: chi l'aveva salvato senza riceve il default).
  motion: z._default(z.int().check(z.gte(0), z.lte(100)), DEFAULT_MOTION_LEVEL),
  // Colore scelto per ciascuno sfondo (manca = "original").
  palettes: z._default(z.partialRecord(z.enum(BACKGROUNDS), z.enum(PALETTE_IDS)), {}),
});
export type Appearance = z.infer<typeof schema>;

const DEFAULTS: Appearance = { background: DEFAULT_BACKGROUND, motion: DEFAULT_MOTION_LEVEL, palettes: {} };

export const appearance = defineStore("appearance", schema, DEFAULTS);

export function paletteFor(settings: Appearance, background: BackgroundId): PaletteId {
  return settings.palettes[background] ?? "original";
}
