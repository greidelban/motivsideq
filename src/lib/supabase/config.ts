import { z } from "zod";

// Configurazione pubblica di Supabase. Le variabili NEXT_PUBLIC_* vanno lette per
// nome esatto, altrimenti Next non le inserisce nel bundle del browser.
// Se mancano, l'app funziona come prima (solo sul dispositivo) e l'account non compare.

const schema = z.object({
  url: z.url(),
  anonKey: z.string().min(20),
  siteUrl: z.url(),
});

export type SupabaseConfig = z.infer<typeof schema>;

export function supabaseConfig(): SupabaseConfig | null {
  const parsed = schema.safeParse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
  });
  return parsed.success ? parsed.data : null;
}
