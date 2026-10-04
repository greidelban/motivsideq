export type Plan = "free" | "pro";

// Unico punto che decide cosa è sbloccato per ciascun piano.
// Il piano vero lo decide il server (`profiles.plan`, aggiornato dalla verifica
// degli acquisti in-app): il cloud cifrato lo controlla anche il database.
export type Feature = "journal" | "workouts" | "nutrition" | "insights" | "cycle" | "export" | "chat" | "cloud";

/** Senza account c'è solo il piano gratuito. */
export const LOCAL_USER: { plan: Plan } = { plan: "free" };

const PLANS_BY_FEATURE: Record<Feature, readonly Plan[]> = {
  // La chat in incognito sarà inclusa nell'abbonamento: per ora resta col lucchetto.
  chat: ["pro"],
  // Cloud cifrato e sincronizzazione tra dispositivi (src/lib/sync/run.ts legge il piano dal server).
  cloud: ["pro"],
  journal: ["free", "pro"],
  workouts: ["free", "pro"],
  nutrition: ["free", "pro"],
  insights: ["free", "pro"],
  cycle: ["free", "pro"],
  export: ["free", "pro"],
};

export function can(user: { plan: Plan }, feature: Feature): boolean {
  return PLANS_BY_FEATURE[feature].includes(user.plan);
}
