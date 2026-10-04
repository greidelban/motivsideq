import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

// Prova dello schema v2 su un Postgres in memoria (PGlite), con finte tabelle auth.
// Per ora si lancia a mano: node supabase/proposta/schema_v2.check.mjs (serve @electric-sql/pglite).
// In A2 diventerà un test di Vitest.
const root = fileURLToPath(new URL("..", import.meta.url));
const core = readFileSync(`${root}/migrations/20261003090000_core.sql`, "utf8");
// Dalla core servono solo le utilità (prima di "profiles"): il resto lo sostituisce la proposta.
const coreUtils = core.slice(core.indexOf("create or replace function public.set_updated_at"), core.indexOf("-- profiles\n"));
const proposal = readFileSync(`${root}/proposta/schema_v2.sql`, "utf8");

const db = new PGlite();
await db.exec(`
  create role anon; create role authenticated;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to authenticated, anon;
  grant execute on function auth.uid() to authenticated, anon;
`);
await db.exec(coreUtils);
await db.exec(proposal);
console.log("✓ schema creato");

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
await db.exec(`insert into auth.users values ('${A}'), ('${B}')`);

let failures = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "✓" : "✗"} ${name}${extra ? ` (${extra})` : ""}`);
  if (!ok) failures++;
};
const as = async (user, sql) => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user}', false); set role authenticated;`);
  return db.query(sql);
};
const fails = async (user, sql) => {
  try {
    await as(user, sql);
    return null;
  } catch (e) {
    return e.message;
  }
};

// Profilo: quello del telefono vince al primo caricamento (updated_at = -infinity).
await as(A, `update profiles set sex = 'female', birth_year = 1995, birth_month = 3, height_cm = 165, updated_at = '2026-10-01T10:00:00Z'`);
let r = await as(A, `select sex, height_cm from profiles`);
check("profilo dal telefono accettato", r.rows[0]?.sex === "female");
check("non si scrive plan", (await fails(A, `update profiles set plan = 'pro'`)) !== null);
check("non si accende il ciclo a mano", (await fails(A, `update profiles set cycle_tracking_enabled = true`)) !== null);

// Peso: vince l'ultima modifica.
await as(A, `insert into body_weights (measured_on, weight_kg, updated_at) values ('2026-10-01', 60, '2026-10-01T08:00:00Z')`);
await as(A, `insert into body_weights (measured_on, weight_kg, updated_at) values ('2026-10-01', 59, '2026-09-30T08:00:00Z')
             on conflict (user_id, measured_on) do update set weight_kg = excluded.weight_kg, updated_at = excluded.updated_at`);
r = await as(A, `select weight_kg from body_weights`);
check("versione più vecchia ignorata", Number(r.rows[0].weight_kg) === 60);
await as(A, `insert into body_weights (measured_on, weight_kg, updated_at) values ('2026-10-01', 61, '2026-10-02T08:00:00Z')
             on conflict (user_id, measured_on) do update set weight_kg = excluded.weight_kg, updated_at = excluded.updated_at`);
r = await as(A, `select weight_kg from body_weights`);
check("versione più recente applicata", Number(r.rows[0].weight_kg) === 61);
await as(A, `insert into body_weights (measured_on, weight_kg, updated_at) values ('2026-10-03', 61, '2999-01-01')`);
r = await as(A, `select updated_at from body_weights where measured_on = '2026-10-03'`);
check("orologio nel futuro corretto", new Date(r.rows[0].updated_at).getFullYear() < 2100);
check("niente DELETE dal client", (await fails(A, `delete from body_weights`)) !== null);
r = await as(B, `select * from body_weights`);
check("B non vede i dati di A", r.rows.length === 0);

// Allenamenti e Mente.
await as(A, `insert into workout_sessions (id, performed_on, activity_type, duration_min, intensity, notes)
             values (gen_random_uuid(), '2026-10-04', 'running', 45, 2, 'parco')`);
check("tipo di allenamento sconosciuto rifiutato",
  (await fails(A, `insert into workout_sessions (id, performed_on, activity_type, duration_min, intensity) values (gen_random_uuid(), '2026-10-04', 'boh', 10, 1)`)) !== null);
await as(A, `update workout_sessions set deleted_at = now(), updated_at = now()`);
r = await as(A, `select notes, deleted_at from workout_sessions`);
check("cancellazione morbida svuota la nota", r.rows[0].notes === null && r.rows[0].deleted_at !== null);
await as(A, `insert into brain_results (id, game, variant, played_at, played_on, score, metrics)
             values (gen_random_uuid(), 'reaction', 'default', now(), '2026-10-04', 280, '{"best": 250}')`);

// Diario: testo cifrato non indicizzato.
await as(A, `insert into journal_entries (entry_date, mood, energy, content) values ('2026-10-04', 4, 3, 'giornata ottima')`);
await as(A, `insert into journal_entries (entry_date, content, content_encryption) values ('2026-10-05', 'QUJD', 1)`);
r = await as(A, `select entry_date::text, search is null as no_search from journal_entries order by entry_date`);
check("testo in chiaro indicizzato, cifrato no", r.rows[0].no_search === false && r.rows[1].no_search === true);

// Ciclo: senza consenso niente; con consenso sì; uomo → sparisce; cancellazione totale.
const period = `insert into cycle_periods (id, start_date, updated_at) values (gen_random_uuid(), '2026-09-26', '2026-09-26T09:00:00Z')`;
check("ciclo bloccato senza consenso", (await fails(A, period)) !== null);
check("versione informativa sbagliata rifiutata", (await fails(A, `select grant_cycle_consent('vecchia')`)) !== null);
await as(A, `select grant_cycle_consent(current_cycle_policy_version())`);
await as(A, period);
await as(A, `insert into cycle_day_logs (log_date, flow, symptoms) values ('2026-09-26', 'medium', '{cramps,insomnia}')`);
check("sintomo sconosciuto rifiutato",
  (await fails(A, `insert into cycle_day_logs (log_date, symptoms) values ('2026-09-27', '{boh}')`)) !== null);
r = await as(A, `select count(*)::int as n from cycle_periods`);
check("ciclo visibile con consenso", r.rows[0].n === 1);

await as(B, `update profiles set sex = 'male', birth_year = 1990, birth_month = 1, updated_at = now()`);
check("uomo: consenso al ciclo rifiutato", (await fails(B, `select grant_cycle_consent(current_cycle_policy_version())`)) !== null);

await as(A, `update profiles set sex = 'male', updated_at = now()`);
r = await as(A, `select cycle_tracking_enabled from profiles`);
check("cambio sesso spegne il ciclo", r.rows[0].cycle_tracking_enabled === false);
r = await as(A, `select count(*)::int as n from cycle_periods`);
check("dati conservati ma invisibili", r.rows[0].n === 0);
r = await as(A, `select export_my_data() -> 'cycle_periods' as p`);
check("export include il ciclo anche spento", r.rows[0].p.length === 1);

await as(A, `update profiles set sex = 'female', updated_at = now()`);
await as(A, `select set_cycle_tracking(true)`);
r = await as(A, `select count(*)::int as n from cycle_periods`);
check("riacceso: dati di nuovo visibili", r.rows[0].n === 1);

await as(A, `select delete_cycle_data()`);
await db.exec(`reset role`);
r = await db.query(`select (select count(*) from cycle_periods)::int as p, (select count(*) from cycle_day_logs)::int as l`);
check("cancellazione totale vera", r.rows[0].p === 0 && r.rows[0].l === 0);
await as(A, `select grant_cycle_consent(current_cycle_policy_version())`);
await as(A, period); // riga vecchia da un telefono rimasto offline
await db.exec(`reset role`);
r = await db.query(`select count(*)::int as n from cycle_periods`);
check("righe vecchie non risorgono dopo la cancellazione", r.rows[0].n === 0);

// Data di nascita correggibile; regole dei minorenni ricalcolate a ogni scrittura.
await as(B, `update profiles set goal = 'lose', kcal_goal = 2000, updated_at = now()`);
await as(B, `update profiles set birth_year = 2010, updated_at = now()`);
r = await as(B, `select birth_year, goal, kcal_goal from profiles`);
check("data di nascita correggibile", r.rows[0].birth_year === 2010);
check("minorenne: dimagrire → mantenere, niente kcal", r.rows[0].goal === "maintain" && r.rows[0].kcal_goal === null);
check("sotto i 14 anni rifiutato", (await fails(B, `update profiles set birth_year = 2020, updated_at = now()`)) !== null);

// Limite giornaliero: un invio ritentato non consuma il limite due volte.
const batch = (n, kg) =>
  `insert into body_weights (measured_on, weight_kg, updated_at) values ${Array.from({ length: n }, (_, i) => `('2026-01-${String(i + 1).padStart(2, "0")}', ${kg}, now())`).join(", ")}
   on conflict (user_id, measured_on) do update set weight_kg = excluded.weight_kg, updated_at = excluded.updated_at`;
await db.exec(`reset role; delete from write_counters`);
await as(B, batch(10, 70));
await as(B, batch(10, 71)); // stesso invio ritentato
await db.exec(`reset role`);
r = await db.query(`select count from write_counters where table_name = 'body_weights'`);
check("invio ritentato contato una volta sola", r.rows[0].count === 10, `contatore ${r.rows[0].count}`);
await db.exec(`update write_counters set count = 2000 where table_name = 'body_weights'`);
const limitError = await fails(B, `insert into body_weights (measured_on, weight_kg) values ('2026-10-10', 60)`);
check("limite giornaliero raggiunto", limitError !== null, limitError ?? "");
await db.exec(`reset role`);
r = await db.query(`select count from write_counters where table_name = 'body_weights'`);
check("riga rifiutata non consuma il limite", r.rows[0].count === 2000);
check("aggiornare righe esistenti resta possibile al limite", (await fails(B, batch(3, 72))) === null);
check("contatori non leggibili dal client", (await fails(A, `select * from write_counters`)) !== null);

console.log(failures ? `\n${failures} controlli falliti` : "\nTutti i controlli passati");
process.exit(failures ? 1 : 0);
