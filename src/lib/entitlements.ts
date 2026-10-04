export type Plan = "free" | "pro";

// Unico punto che decide cosa è sbloccato per ciascun piano.
// Oggi è tutto gratuito; per aggiungere un tier basta cambiare questa tabella
// (e, in futuro, aggiornare `profiles.plan` dal webhook di pagamento).
export type Feature = "journal" | "workouts" | "nutrition" | "insights" | "cycle" | "export";

const PLANS_BY_FEATURE: Record<Feature, readonly Plan[]> = {
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
