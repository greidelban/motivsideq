"use client";

import { z } from "zod";
import { defineStore } from "@/lib/storage/local-store";
import { ZETAMAC_DURATIONS, ZETAMAC_LEVELS, type ZetamacDuration, type ZetamacLevel } from "./zetamac";

const levelIds = Object.keys(ZETAMAC_LEVELS) as [ZetamacLevel, ...ZetamacLevel[]];

const schema = z.object({
  zetamacLevel: z.enum(levelIds),
  zetamacDuration: z.union(ZETAMAC_DURATIONS.map((d) => z.literal(d)) as [z.ZodLiteral<ZetamacDuration>, z.ZodLiteral<ZetamacDuration>]),
});

export type BrainSettings = z.infer<typeof schema>;

const DEFAULTS: BrainSettings = { zetamacLevel: "classic", zetamacDuration: 120 };

export const brainSettings = defineStore("brain-settings", schema, DEFAULTS);

// Nella routine del mattino il calcolo dura sempre 60 secondi.
export const ROUTINE_ZETAMAC_DURATION: ZetamacDuration = 60;
