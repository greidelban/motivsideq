"use client";

import { defineStore } from "@/lib/storage/local-store";
import { DEFAULT_CYCLE_PREFS, cyclePrefsSchema } from "./cycle-reminders";

// Preferenze del Ciclo legate a questo telefono (promemoria, scheda in Oggi):
// in localStorage, mai nel cloud né nel backup. Non contengono dati sanitari.
export const cyclePrefs = defineStore("cycle-prefs", cyclePrefsSchema, DEFAULT_CYCLE_PREFS);
