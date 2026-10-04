"use client";

import { localDb } from "@/lib/storage/db";
import { DEFS } from "@/lib/storage/definitions";

export const profile = localDb.store(DEFS.profile);

/** Storico del peso (come la tabella body_weights): l'ultimo valore è il peso attuale. */
export const bodyWeights = localDb.store(DEFS.bodyWeights);
