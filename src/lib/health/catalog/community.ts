"use client";

import { defineStore } from "@/lib/storage/local-store";
import { accountAvailable, hasStoredSession, loadSupabase } from "@/lib/supabase/client";
import { type CorrectionInput, EMPTY_CONSENSUS, consensusSchema, needsRefresh, parseConsensusRows } from "./corrections";

// Valori della comunità e invio delle correzioni (vedi corrections.ts).
// I valori sono gli stessi per tutti e non dicono nulla di chi li scarica:
// si tengono in localStorage (dato del dispositivo, non dell'utente), fuori dal
// backup e dal cloud. Si scaricano solo con un account collegato.
export const foodConsensus = defineStore("food-consensus", consensusSchema, EMPTY_CONSENSUS);

let refreshing = false;

/** Riscarica i valori della comunità se è passato un giorno (in silenzio se qualcosa non va). */
export async function refreshConsensus(): Promise<void> {
  if (refreshing || !accountAvailable() || !hasStoredSession() || !needsRefresh(foodConsensus.get())) return;
  refreshing = true;
  try {
    const supabase = await loadSupabase();
    if (!supabase) return;
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return;
    const { data, error } = await supabase.rpc("food_consensus");
    if (!error) foodConsensus.set(parseConsensusRows(data));
  } catch {
    // Offline o server non raggiungibile: si riprova la prossima volta.
  } finally {
    refreshing = false;
  }
}

export type SubmitResult = "ok" | "needAccount" | "limit" | "error";

export async function submitCorrection(foodId: string, values: CorrectionInput): Promise<SubmitResult> {
  try {
    const supabase = await loadSupabase();
    if (!supabase) return "needAccount";
    const { error } = await supabase.rpc("submit_food_correction", {
      p_food_id: foodId,
      p_kcal: Math.round(values.kcal * 10) / 10,
      p_protein: values.protein,
      p_carbs: values.carbs,
      p_fat: values.fat,
    });
    if (!error) return "ok";
    if (error.code === "FC001" || error.code === "FC002") return "needAccount";
    if (error.code === "RL001") return "limit";
    return "error";
  } catch {
    return "error";
  }
}
