import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { type Remote, RemoteError, type RemoteErrorKind } from "./engine";
import type { Row } from "./tables";

// Il "Remote" vero: tabelle di Supabase tramite PostgREST, con la sessione
// dell'utente (la RLS decide cosa si può leggere e scrivere).

/** Traduce un errore del database nel tipo che decide cosa fare dopo. */
export function classify(error: Pick<PostgrestError, "code" | "message">, online = true): RemoteErrorKind {
  if (error.code === "RL001") return "limit"; // limite giornaliero (rate_limit_inserts)
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
    async upsert(table, rows, onConflict) {
      const { error } = await client.from(table).upsert(rows, { onConflict });
      check(error);
    },
    async markDeleted(table, keyColumn, key, deletedAt, updatedAt) {
      const { error } = await client.from(table).update({ deleted_at: deletedAt, updated_at: updatedAt }).eq(keyColumn, key);
      check(error);
    },
    async pullSince(table, since, limit) {
      let query = client.from(table).select("*").order("server_updated_at", { ascending: true }).limit(limit);
      if (since) query = query.gt("server_updated_at", since);
      const { data, error } = await query;
      check(error);
      return (data ?? []) as Row[];
    },
  };
}
