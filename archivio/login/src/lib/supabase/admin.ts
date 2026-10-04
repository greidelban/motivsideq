import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import type { Database } from "./types";

// Client con chiave service_role: scavalca la RLS. Usarlo SOLO in route server
// che hanno già verificato l'utente (es. cancellazione account). Mai nel browser:
// `server-only` fa fallire la build se qualcuno lo importa da un componente client.
export function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY mancante in .env.local (vedi README).");
  }
  return createClient<Database>(publicEnv().NEXT_PUBLIC_SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
