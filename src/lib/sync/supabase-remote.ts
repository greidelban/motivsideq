import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { type Remote, RemoteError, type RemoteErrorKind, type VaultRow } from "./engine";

// Il "Remote" vero: la tabella vault_records di Supabase tramite PostgREST, con
// la sessione dell'utente (la RLS decide cosa si può leggere e scrivere).

const COLUMNS = "id, key_id, payload, updated_at, deleted_at, server_updated_at";

/** Traduce un errore del database nel tipo che decide cosa fare dopo. */
function classify(error: Pick<PostgrestError, "code" | "message">, online = true): RemoteErrorKind {
  if (error.code === "RL001") return "limit"; // limite giornaliero (rate_limit_inserts)
  if (error.code === "RL002") return "full"; // tetto di righe o di spazio dell'account
  if (error.code === "KY001") return "key"; // chiave di cifratura non più valida
  if (error.code === "42501") return "plan"; // RLS: il cloud non è nel piano
  if (error.code === "PGRST301" || error.code === "PGRST303" || /jwt/i.test(error.message)) return "auth";
  if (!online || /fetch|network|load failed/i.test(error.message)) return "network";
  return "other";
}

function check(error: PostgrestError | null) {
  if (error) {
    const online = typeof navigator === "undefined" || navigator.onLine;
    throw new RemoteError(classify(error, online), `${error.code}: ${error.message}`);
  }
}

export function supabaseRemote(client: SupabaseClient): Remote {
  return {
    async upsert(rows) {
      const { error } = await client.from("vault_records").upsert(rows, { onConflict: "user_id,id" });
      check(error);
    },
    async pullSince(since, limit) {
      let query = client.from("vault_records").select(COLUMNS).order("server_updated_at", { ascending: true }).limit(limit);
      if (since) query = query.gt("server_updated_at", since);
      const { data, error } = await query;
      check(error);
      return (data ?? []) as VaultRow[];
    },
  };
}

/** Piano dell'account (il cloud richiede l'abbonamento). */
export async function fetchPlan(client: SupabaseClient): Promise<"free" | "pro"> {
  const { data, error } = await client.from("profiles").select("plan").maybeSingle();
  check(error);
  return data?.plan === "pro" ? "pro" : "free";
}

export type ServerKey = { keyId: string; wrappedKey: string };

/** Chiave impacchettata dell'account, o null se il cloud cifrato non è ancora attivo. */
export async function fetchServerKey(client: SupabaseClient): Promise<ServerKey | null> {
  const { data, error } = await client.from("user_keys").select("key_id, wrapped_key").maybeSingle();
  check(error);
  return data ? { keyId: data.key_id, wrappedKey: data.wrapped_key } : null;
}

/** Primo dispositivo: salva la chiave impacchettata. false se un altro dispositivo l'ha appena creata. */
export async function createServerKey(client: SupabaseClient, key: ServerKey): Promise<boolean> {
  const { error } = await client.from("user_keys").insert({ key_id: key.keyId, wrapped_key: key.wrappedKey });
  if (error?.code === "23505") return false;
  check(error);
  return true;
}

/** Nuovo codice di recupero: cambia solo l'involucro della stessa chiave. */
export async function updateWrappedKey(client: SupabaseClient, wrappedKey: string): Promise<void> {
  const { data, error } = await client.from("user_keys").update({ wrapped_key: wrappedKey }).not("key_id", "is", null).select("key_id");
  check(error);
  if (!data?.length) throw new RemoteError("other", "Chiave non trovata");
}

/** Cancella davvero le righe cifrate e la chiave dell'account. */
export async function resetServerVault(client: SupabaseClient): Promise<void> {
  const { error } = await client.rpc("reset_vault");
  check(error);
}
