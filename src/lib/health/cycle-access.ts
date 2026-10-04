import { CYCLE_POLICY_VERSION } from "@/lib/legal";
import { type Profile, profileAgeGroup } from "@/lib/profile/profile";
import type { CycleConsent } from "./cycle";

// L'UNICO punto che decide se e come il Ciclo esiste per l'utente: menu di
// Salute, schermata, schede di Oggi, impostazioni e insight passano tutti da qui.
// Nel database lo stesso ruolo lo ha public.can_use_cycle().
// Quando il sesso si chiederà all'onboarding, basterà che l'onboarding scriva
// profile.sex: questa funzione non cambia.

export type CycleAccess =
  /** Sesso diverso da "donna" (o non indicato): il Ciclo non compare da nessuna parte. */
  | "hidden"
  /** Serve la data di nascita per sapere se è maggiorenne. */
  | "needBirth"
  /** Minorenne: si spiega che è disponibile dai 18 anni. */
  | "tooYoung"
  /** Consenso mai dato, o dato su una versione vecchia dell'informativa. */
  | "needConsent"
  /** Messo in pausa (es. dopo aver cambiato sesso e scelto di conservare i dati). */
  | "paused"
  | "ok";

export function canUseCycle(profile: Profile, consent: CycleConsent, today: Date = new Date()): CycleAccess {
  if (profile.sex !== "female") return "hidden";
  const group = profileAgeGroup(profile, today);
  if (group === null) return "needBirth";
  if (group !== "adult") return "tooYoung";
  if (!consent || consent.policyVersion !== CYCLE_POLICY_VERSION) return "needConsent";
  if (!consent.enabled) return "paused";
  return "ok";
}

export const isCycleVisible = (access: CycleAccess) => access !== "hidden";

/** Ci sono dati del ciclo su questo dispositivo? (per chiedere cosa farne se il sesso cambia) */
export function hasCycleData(periods: readonly unknown[], logs: readonly unknown[], consent: CycleConsent): boolean {
  return periods.length > 0 || logs.length > 0 || consent !== null;
}
