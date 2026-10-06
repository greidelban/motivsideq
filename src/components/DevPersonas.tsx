"use client";

import { useEffect } from "react";
import { brainResults } from "@/lib/brain/store";
import { localDateKey } from "@/lib/dates";
import { PERSONAS, type PersonaId, personaHistory } from "@/lib/dev/personas";
import { cycleConsent, cyclePeriods, workouts } from "@/lib/health/store";
import { checkIns } from "@/lib/journal/store";
import { CYCLE_POLICY_VERSION } from "@/lib/legal";
import { upsertWeight } from "@/lib/profile/profile";
import { bodyWeights, profile } from "@/lib/profile/store";

// Solo in sviluppo, dalla console:
//  - window.__persona("giorgio" | "marta") carica un profilo di prova (lib/dev/personas.ts);
//  - window.__persona("marta", 45) aggiunge anche 45 giorni di storico verosimile
//    (check-in, allenamenti, riflessi e, per Marta, mestruazioni con il consenso).
// Funziona solo su 127.0.0.1, l'archivio separato usato per le prove: su
// localhost ci sono i dati veri dell'utente e non si toccano.
export function DevPersonas() {
  useEffect(() => {
    Object.assign(window, {
      __persona(id: PersonaId, historyDays = 0) {
        if (window.location.hostname !== "127.0.0.1") return "Solo su http://127.0.0.1:3000 (archivio di prova).";
        const persona = PERSONAS[id];
        if (!persona) return `Profili: ${Object.keys(PERSONAS).join(", ")}`;
        const today = localDateKey();
        profile.set({ ...persona.profile });
        bodyWeights.set((prev) => upsertWeight(prev, { day: today, kg: persona.kg }));
        if (historyDays > 0) {
          const h = personaHistory(id, today, historyDays);
          const at = (day: string) => `${day}T18:00:00.000Z`;
          checkIns.set(h.checkIns);
          workouts.set(h.workouts.map((w) => ({ ...w, id: `demo-${w.day}`, at: at(w.day) })));
          brainResults.set(
            h.reactions.map((r) => ({ id: `demo-${r.day}`, game: "reaction", variant: "classic", at: at(r.day), day: r.day, score: r.score, metrics: {}, routine: false })),
          );
          cyclePeriods.set(h.periods);
          cycleConsent.set(h.periods.length ? { acceptedAt: new Date().toISOString(), policyVersion: CYCLE_POLICY_VERSION, enabled: true } : null);
        }
        return `${persona.profile.displayName} caricato${historyDays ? ` con ${historyDays} giorni di storico` : ""}.`;
      },
    });
  }, []);
  return null;
}
