"use client";

import * as z from "zod/mini";
import { defineStore } from "@/lib/storage/local-store";
import { DEFAULT_QUOTE_PREFERENCES, quotePreferencesSchema } from "./preferences";

// Tutto ciò che riguarda le frasi resta su questo dispositivo (localStorage):
// non è nel backup né nel cloud, e non lascia mai il telefono.

export const quotePrefs = defineStore("quotes", quotePreferencesSchema, DEFAULT_QUOTE_PREFERENCES);

/** Notifiche sponsorizzate già programmate o arrivate: servono solo ai limiti di frequenza. */
export const sponsorLog = defineStore(
  "sponsor-log",
  z.array(z.object({ sponsor: z.string(), day: z.string(), at: z.number() })).check(z.maxLength(200)),
  [],
);

/** Ultimo file sponsor scaricato, così com'è: la firma si riverifica a ogni lettura. */
export const sponsorFeedCache = defineStore(
  "sponsor-feed",
  z.nullable(z.object({ raw: z.string(), fetchedAt: z.number() })),
  null,
);
