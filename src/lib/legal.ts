// Deve coincidere con public.current_disclaimer_version() nel database futuro.
// Se il testo del disclaimer (nei dizionari, legal.disclaimer) cambia in modo
// sostanziale: nuova versione qui e nuova migrazione.
export const DISCLAIMER_VERSION = "2026-10-03";

// Versione dell'informativa sui dati del ciclo: deve coincidere con
// public.current_cycle_policy_version() (supabase/migrations/…_core.sql).
// Cambiandola, tutte devono ridare il consenso (i dati restano).
export const CYCLE_POLICY_VERSION = "2026-10-04";
