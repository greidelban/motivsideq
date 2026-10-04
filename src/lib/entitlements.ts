export type Plan = "free" | "pro";

// Unico punto che decide cosa è sbloccato per ciascun piano.
// Oggi è tutto gratuito; per aggiungere un tier basta cambiare questa tabella
// (e, in futuro, aggiornare `profiles.plan` dal webhook di pagamento).
export type Feature = "journal" | "workouts" | "nutrition" | "insights" | "cycle" | "export" | "chat";

/** Senza account c'è solo il piano gratuito (con Stripe arriverà da `profiles.plan`). */
export const LOCAL_USER: { plan: Plan } = { plan: "free" };

const PLANS_BY_FEATURE: Record<Feature, readonly Plan[]> = {
  // La chat in incognito sarà inclusa nell'abbonamento: per ora resta col lucchetto.
  chat: ["pro"],
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
