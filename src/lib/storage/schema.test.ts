import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { expect, it } from "vitest";

// Prova delle migrazioni di supabase/migrations/ su un Postgres in memoria
// (PGlite), con finte tabelle "auth" al posto di quelle di Supabase.
// Controlla lo stato finale: caveau cifrato, abbonamento, RLS, limiti.

const dir = fileURLToPath(new URL("../../../supabase/migrations/", import.meta.url));

// Colonne ammesse nelle tabelle pubbliche: nessuna contiene dati dell'utente in
// chiaro. Una colonna nuova va aggiunta qui solo se il gestore può vederla.
const PUBLIC_COLUMNS: Record<string, string[]> = {
  profiles: ["id", "plan", "created_at", "updated_at", "server_updated_at"],
  user_keys: ["user_id", "key_id", "wrapped_key", "created_at", "updated_at"],
  vault_records: ["user_id", "id", "key_id", "payload", "created_at", "updated_at", "deleted_at", "server_updated_at"],
  vault_usage: ["user_id", "bytes"],
  write_counters: ["user_id", "table_name", "day", "count"],
  row_totals: ["user_id", "table_name", "count"],
  // Correzioni degli alimenti: dati condivisi, non personali (nessun id dell'account, solo un'impronta).
  food_secret: ["id", "secret"],
  food_corrections: ["food_id", "voter", "kcal", "protein", "carbs", "fat", "updated_on"],
};

const KEY_A = "a".repeat(32);
const KEY_B = "b".repeat(32);
const WRAPPED = `v1.${"Q".repeat(80)}`;
const rid = (n: number) => n.toString(16).padStart(64, "0");

it("le migrazioni rispettano tutte le regole dello schema", { timeout: 60_000 }, async () => {
  const db = new PGlite({ extensions: { pg_trgm } });
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
    create schema extensions;
  `);
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(dir + file, "utf8"));
  }

  const check = (name: string, ok: boolean, extra = "") => expect(ok, `${name}${extra ? ` (${extra})` : ""}`).toBe(true);
  const as = async (user: string, sql: string) => {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user}', false); set role ${user ? "authenticated" : "anon"};`);
    return db.query<Record<string, never>>(sql);
  };
  const fails = async (user: string, sql: string): Promise<string | null> => {
    try {
      await as(user, sql);
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  };
  const admin = async (sql: string) => {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
    return db.query<Record<string, never>>(sql);
  };
  // Upsert come lo fa il telefono (PostgREST): "do update set" su tutte le colonne inviate.
  const push = (id: string, opts: { key?: string; updated?: string; payload?: string; deleted?: boolean } = {}) =>
    `insert into vault_records (id, key_id, payload, updated_at, deleted_at)
     values ('${id}', '${opts.key ?? KEY_A}', '${opts.payload ?? "v1.QUJD"}', '${opts.updated ?? "2026-10-05T09:00:00Z"}', ${opts.deleted ? "now()" : "null"})
     on conflict (user_id, id) do update set id = excluded.id, key_id = excluded.key_id, payload = excluded.payload,
       updated_at = excluded.updated_at, deleted_at = excluded.deleted_at`;

  const A = "11111111-1111-1111-1111-111111111111";
  const B = "22222222-2222-2222-2222-222222222222";
  const FREE = "33333333-3333-3333-3333-333333333333";
  await db.exec(`insert into auth.users values ('${A}'), ('${B}'), ('${FREE}')`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- righe del database senza tipo
  let r: { rows: any[] };

  // Zero dati in chiaro: solo le colonne ammesse.
  r = await admin(`select table_name, column_name from information_schema.columns where table_schema = 'public'`);
  const extra = r.rows.filter((c) => !PUBLIC_COLUMNS[c.table_name]?.includes(c.column_name)).map((c) => `${c.table_name}.${c.column_name}`);
  check("nessuna colonna con dati dell'utente in chiaro", extra.length === 0, extra.join(", "));

  // Profilo: creato alla registrazione, il piano non si cambia dal client.
  r = await as(A, `select plan from profiles`);
  check("profilo creato con piano gratuito", r.rows[0]?.plan === "free");
  check("non si scrive plan", (await fails(A, `update profiles set plan = 'pro'`)) !== null);
  check("gli anonimi non leggono i profili", (await fails("", `select * from profiles`)) !== null);

  // Senza abbonamento niente cloud.
  check("gratis: niente chiave nel cloud", (await fails(FREE, `insert into user_keys (key_id, wrapped_key) values ('${KEY_A}', '${WRAPPED}')`)) !== null);
  await admin(`insert into user_keys (user_id, key_id, wrapped_key) values ('${FREE}', '${KEY_A}', '${WRAPPED}')`);
  check("gratis: niente righe nel cloud", (await fails(FREE, push(rid(1)))) !== null);
  r = await as(FREE, `select has_cloud() as ok`);
  check("has_cloud falso col piano gratuito", r.rows[0].ok === false);

  await admin(`update profiles set plan = 'pro' where id in ('${A}', '${B}')`);

  // Chiave: una per utente, l'impronta non si cambia, l'involucro sì.
  await as(A, `insert into user_keys (key_id, wrapped_key) values ('${KEY_A}', '${WRAPPED}')`);
  check("involucro non valido rifiutato", (await fails(B, `insert into user_keys (key_id, wrapped_key) values ('${KEY_B}', 'in chiaro')`)) !== null);
  await as(B, `insert into user_keys (key_id, wrapped_key) values ('${KEY_B}', '${WRAPPED}')`);
  check("nuovo codice di recupero: l'involucro si aggiorna", (await fails(A, `update user_keys set wrapped_key = '${WRAPPED.replace("Q", "R")}'`)) === null);
  check("l'impronta della chiave non si cambia", (await fails(A, `update user_keys set key_id = '${KEY_B}'`)) !== null);
  r = await as(B, `select key_id from user_keys`);
  check("B vede solo la sua chiave", r.rows.length === 1 && r.rows[0].key_id === KEY_B);

  // Righe cifrate: vince l'ultima modifica.
  await as(A, push(rid(1), { payload: "v1.UFJJTUE=", updated: "2026-10-05T09:00:00Z" }));
  await as(A, push(rid(1), { payload: "v1.VkVDQ0hJQQ==", updated: "2026-10-04T09:00:00Z" }));
  r = await as(A, `select payload from vault_records`);
  check("versione più vecchia ignorata", r.rows[0].payload === "v1.UFJJTUE=");
  await as(A, push(rid(1), { payload: "v1.RE9QTw==", updated: "2026-10-05T10:00:00Z" }));
  r = await as(A, `select payload from vault_records`);
  check("versione più recente applicata", r.rows[0].payload === "v1.RE9QTw==");
  await as(A, push(rid(2), { updated: "2999-01-01T00:00:00Z" }));
  r = await as(A, `select updated_at from vault_records where id = '${rid(2)}'`);
  check("orologio nel futuro corretto", new Date(r.rows[0].updated_at).getFullYear() < 2100);
  await as(A, push(rid(1), { updated: "2026-10-05T11:00:00Z", deleted: true }));
  r = await as(A, `select deleted_at from vault_records where id = '${rid(1)}'`);
  check("cancellazione come segnale", r.rows[0].deleted_at !== null);
  check("niente DELETE dal client", (await fails(A, `delete from vault_records`)) !== null);

  // Formato: solo id casuali e testo cifrato.
  check("id leggibile rifiutato", (await fails(A, push("2026-10-05"))) !== null);
  check("contenuto in chiaro rifiutato", (await fails(A, push(rid(3), { payload: '{"kg": 70}' }))) !== null);
  const big = `v1.${"A".repeat(262_200)}`;
  check("riga troppo grande rifiutata", (await fails(A, push(rid(3), { payload: big }))) !== null);

  // Chiave sbagliata (dispositivo rimasto indietro): rifiutata con un codice dedicato.
  const stale = await fails(A, push(rid(4), { key: KEY_B }));
  check("righe con una chiave non più valida rifiutate", stale?.includes("Chiave di cifratura") === true, stale ?? "");

  // Separazione tra utenti.
  r = await as(B, `select * from vault_records`);
  check("B non vede le righe di A", r.rows.length === 0);
  await as(B, `update vault_records set payload = 'v1.Rk9P' where id = '${rid(2)}'`);
  r = await as(A, `select payload from vault_records where id = '${rid(2)}'`);
  check("B non modifica le righe di A", r.rows[0].payload === "v1.QUJD");
  check("stesso id in due account: ognuno ha la sua riga", (await fails(B, push(rid(2), { key: KEY_B }))) === null);
  check("gli anonimi non leggono il caveau", (await fails("", `select * from vault_records`)) !== null);
  check("contatori non leggibili dal client", (await fails(A, `select * from write_counters`)) !== null);
  check("spazio occupato non leggibile dal client", (await fails(A, `select * from vault_usage`)) !== null);

  // Abbonamento scaduto: i dati si leggono ancora, ma non si scrive più.
  await admin(`update profiles set plan = 'free' where id = '${B}'`);
  r = await as(B, `select count(*)::int as n from vault_records`);
  check("abbonamento scaduto: lettura possibile", r.rows[0].n === 1);
  check("abbonamento scaduto: niente nuove righe", (await fails(B, push(rid(5), { key: KEY_B }))) !== null);
  await admin(`update profiles set plan = 'pro' where id = '${B}'`);

  // Limite giornaliero: un invio ritentato non consuma il limite due volte.
  const batch = (from: number, n: number, updated: string) =>
    `insert into vault_records (id, key_id, payload, updated_at)
     values ${Array.from({ length: n }, (_, i) => `('${rid(from + i)}', '${KEY_B}', 'v1.QUJD', '${updated}')`).join(", ")}
     on conflict (user_id, id) do update set payload = excluded.payload, updated_at = excluded.updated_at`;
  await admin(`delete from write_counters`);
  await as(B, batch(100, 10, "2026-10-05T09:00:00Z"));
  await as(B, batch(100, 10, "2026-10-05T09:05:00Z")); // stesso invio ritentato
  r = await admin(`select count from write_counters where user_id = '${B}'`);
  check("invio ritentato contato una volta sola", r.rows[0].count === 10, `contatore ${r.rows[0].count}`);
  await admin(`update write_counters set count = 50000 where user_id = '${B}'`);
  const limit = await fails(B, batch(200, 1, "2026-10-05T09:00:00Z"));
  check("limite giornaliero raggiunto", limit?.includes("Limite giornaliero") === true, limit ?? "");
  check("al limite si aggiornano ancora le righe esistenti", (await fails(B, batch(100, 3, "2026-10-05T09:10:00Z"))) === null);
  await admin(`delete from write_counters`);

  // Tetto totale di righe.
  await admin(`update row_totals set count = 500000 where user_id = '${B}'`);
  const full = await fails(B, batch(300, 1, "2026-10-05T09:00:00Z"));
  check("tetto totale di righe", full?.includes("Spazio dell'account esaurito") === true, full ?? "");
  await admin(`update row_totals set count = 12 where user_id = '${B}'`);

  // Tetto di spazio: conta i byte, anche quando una riga cresce.
  r = await admin(`select bytes from vault_usage where user_id = '${A}'`);
  const before = Number(r.rows[0].bytes);
  check("spazio occupato contato", before > 0);
  await admin(`update vault_usage set bytes = 268435000 where user_id = '${B}'`);
  const space = await fails(B, `update vault_records set payload = 'v1.${"A".repeat(2000)}', updated_at = now() where id = '${rid(100)}'`);
  check("tetto di spazio raggiunto", space?.includes("Spazio dell'account esaurito") === true, space ?? "");
  check("al tetto di spazio una riga si può ancora accorciare", (await fails(B, `update vault_records set payload = 'v1.QQ==', updated_at = now() where id = '${rid(100)}'`)) === null);

  // Scritture del server (senza utente): niente limiti.
  const server = await admin(`insert into vault_records (user_id, id, key_id, payload) values ('${A}', '${rid(9)}', '${KEY_A}', 'v1.QUJD')`).then(
    () => null,
    (e: Error) => e.message,
  );
  check("scrittura del server senza utente", server === null, server ?? "");

  // Ricominciare da zero: righe e chiave cancellate davvero, spazio liberato.
  await as(A, `select reset_vault()`);
  r = await admin(`select (select count(*) from vault_records where user_id = '${A}')::int as rows,
                          (select count(*) from user_keys where user_id = '${A}')::int as keys,
                          (select bytes from vault_usage where user_id = '${A}') as bytes`);
  check("ricomincia da zero: tutto cancellato", r.rows[0].rows === 0 && r.rows[0].keys === 0 && Number(r.rows[0].bytes) === 0);
  check("dopo il reset la chiave vecchia non scrive", (await fails(A, push(rid(1)))) !== null);
  r = await as(B, `select count(*)::int as n from vault_records`);
  check("il reset di A non tocca B", r.rows[0].n > 0);

  // Correzioni degli alimenti: solo email verificate, un voto a persona, fuori solo la mediana.
  const fix = (food: string, kcal: number, p: number, c: number, f: number) => `select submit_food_correction('${food}', ${kcal}, ${p}, ${c}, ${f})`;
  const unverified = await fails(A, fix("pasta-dry", 371, 13, 75, 1.5));
  check("correzione: serve l'email verificata", unverified?.includes("email verificata") === true, unverified ?? "");
  check("correzione: gli anonimi non possono", (await fails("", fix("pasta-dry", 371, 13, 75, 1.5))) !== null);
  const voters = Array.from({ length: 5 }, (_, i) => `4444444${i}-4444-4444-4444-444444444444`);
  await admin(`insert into auth.users values ${voters.map((v) => `('${v}', now())`).join(", ")}`);
  await admin(`update auth.users set email_confirmed_at = now() where id = '${A}'`);
  check("correzione incoerente rifiutata", (await fails(A, fix("pasta-dry", 900, 1, 1, 1))) !== null);
  check("id dell'alimento non valido rifiutato", (await fails(A, fix("Pasta; drop", 371, 13, 75, 1.5))) !== null);
  await as(A, fix("pasta-dry", 360, 12, 74, 1.4));
  await as(A, fix("pasta-dry", 371, 13, 75, 1.5)); // ci ripensa: vale l'ultima
  r = await admin(`select voter from food_corrections`);
  check("un voto per persona", r.rows.length === 1);
  check("nessun id dell'account salvato", !r.rows[0].voter.includes(A.replaceAll("-", "")) && r.rows[0].voter !== A);
  check("le singole correzioni non si leggono", (await fails(A, `select * from food_corrections`)) !== null);
  check("la chiave delle impronte non si legge", (await fails(A, `select * from food_secret`)) !== null);
  for (const [i, v] of voters.slice(0, 3).entries()) await as(v, fix("pasta-dry", 350 + i, 12, 74, 1));
  r = await as(A, `select * from food_consensus()`);
  check("sotto i 5 voti niente valori della comunità", r.rows.length === 0);
  await as(voters[3], fix("pasta-dry", 800, 12, 74, 1).replace("800", "330"));
  // Un valore assurdo ma coerente (tutto grasso) non sposta la mediana.
  await as(voters[4], fix("pasta-dry", 880, 0, 0, 98));
  r = await as(A, `select * from food_consensus()`);
  // Voti: A 371, poi 350, 351, 352, 330, 880 → mediana 351,5.
  check("mediana dei voti", r.rows.length === 1 && r.rows[0].votes === 6 && Number(r.rows[0].kcal) === 351.5 && Number(r.rows[0].fat) === 1, JSON.stringify(r.rows[0]));
  r = await as(A, `select withdraw_food_corrections('pasta-dry') as n`);
  check("ritiro della propria correzione", r.rows[0].n === 1);
  r = await as(A, `select * from food_consensus()`);
  check("dopo il ritiro il voto non conta più", r.rows[0]?.votes === 5 && Number(r.rows[0].kcal) === 351, JSON.stringify(r.rows[0]));

  // Cancellare un account con dati nel cloud: tutto sparisce a cascata, senza errori.
  r = await admin(`select count(*)::int as n from vault_records where user_id = '${B}'`);
  check("B ha righe nel cloud prima della cancellazione", r.rows[0].n > 0);
  const removed = await admin(`delete from auth.users where id = '${B}'`).then(
    () => null,
    (e: Error) => e.message,
  );
  check("cancellare un account con dati nel cloud", removed === null, removed ?? "");
  r = await admin(`select (select count(*) from vault_records where user_id = '${B}')::int as rows,
                          (select count(*) from user_keys where user_id = '${B}')::int as keys,
                          (select count(*) from vault_usage where user_id = '${B}')::int as usage,
                          (select count(*) from profiles where id = '${B}')::int as profiles`);
  check("account cancellato: niente resta", Object.values(r.rows[0]).every((n) => n === 0), JSON.stringify(r.rows[0]));

  await db.close();
});
