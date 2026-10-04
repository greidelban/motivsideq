-- =============================================================================
-- PROPOSTA · Schema v2: sincronizzazione, ciclo solo per le donne, Salute
-- =============================================================================
-- Stato: DA APPROVARE. Non è in supabase/migrations/, quindi non si esegue.
-- Dopo l'approvazione:
--   * la Parte 1 sostituisce profiles e body_weights in 20261003090000_core.sql
--     (il progetto Supabase non esiste ancora: si può riscrivere la core invece
--     di aggiungere ALTER);
--   * le Parti 2-6 diventano nuove migrazioni.
-- Valgono tutte le convenzioni della core (revoke all, RLS, search_path = '').
-- =============================================================================


-- =============================================================================
-- PARTE 0 · Regole comuni di sincronizzazione
-- =============================================================================
-- Ogni riga privata ha:
--   id                → UUID generato sul telefono (crypto.randomUUID), così i
--                        dati creati offline o prima dell'account si caricano
--                        senza conflitti;
--   created_at         → quando è nata sul telefono;
--   updated_at         → ultima modifica sul telefono: decide i conflitti
--                        (vince la modifica più recente);
--   deleted_at         → cancellazione "morbida": la riga resta come segnale per
--                        gli altri dispositivi (il testo libero viene svuotato);
--   server_updated_at  → scritto SOLO dal server: il telefono scarica "tutto ciò
--                        che è cambiato dopo l'ultima volta" in base a questo.
--
-- Le righe "una al giorno" (peso, check-in/diario, registro del ciclo) non
-- hanno id: la chiave è (user_id, giorno). Così due telefoni offline che
-- scrivono lo stesso giorno finiscono sulla stessa riga invece di duplicarla.
--
-- Giorni: ogni colonna "giorno" (date) la calcola il telefono nel fuso
-- dell'utente. Il server non usa mai current_date (che sarebbe in UTC): per
-- questo nessuna colonna giorno ha un default.
--
-- Unità: sempre metriche (kg, cm, ml, °C). kg/lb è solo una preferenza
-- dell'interfaccia (profiles.weight_unit).
--
-- Il client non cancella mai davvero (niente privilegio DELETE): imposta
-- deleted_at. Le cancellazioni vere avvengono solo con la cancellazione
-- dell'account (cascata), con delete_cycle_data() e con la pulizia periodica.

-- Vince l'ultima modifica; orologi sbagliati non possono "vincere per sempre".
create or replace function public.sync_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Un telefono con l'orologio avanti non può scrivere date nel futuro.
  if new.updated_at > now() + interval '5 minutes' then
    new.updated_at := now();
  end if;

  if tg_op = 'INSERT' then
    if new.created_at > now() + interval '5 minutes' then
      new.created_at := now();
    end if;
  else
    -- Versione più vecchia di quella salvata: ignorata in silenzio (la risposta
    -- del server non la contiene, e al prossimo download il telefono riceve
    -- quella giusta).
    if new.updated_at < old.updated_at then
      return null;
    end if;
    new.created_at := old.created_at;
  end if;

  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

-- Limite di nuove righe per utente, tabella e giorno (UTC), contro gli abusi.
-- Un contatore invece di contare le righe: resta veloce anche quando il primo
-- caricamento dal telefono porta migliaia di righe.
create table public.write_counters (
  user_id    uuid not null references auth.users (id) on delete cascade,
  table_name text not null,
  day        date not null,
  count      int not null default 0,
  primary key (user_id, table_name, day)
);
-- Nessun accesso dal client: la scrive solo il trigger qui sotto.
revoke all on table public.write_counters from anon, authenticated;
alter table public.write_counters enable row level security;

-- Uso: trigger "AFTER insert" con il limite giornaliero come argomento.
-- Conta solo le righe davvero nuove: in un "insert ... on conflict do update"
-- le righe già presenti passano dai trigger di UPDATE, non da questo. Così un
-- invio fallito a metà e ritentato non consuma il limite due volte (e se fallisce,
-- l'aumento del contatore viene annullato insieme al resto della transazione).
create or replace function public.rate_limit_inserts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  insert into public.write_counters (user_id, table_name, day, count)
  values (auth.uid(), tg_table_name, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, table_name, day) do update set count = public.write_counters.count + 1
  returning count into v_count;
  if v_count > tg_argv[0]::int then
    -- Codice dedicato: l'app lo riconosce, tiene i dati in coda e riprova il giorno dopo.
    raise exception 'Limite giornaliero di registrazioni raggiunto.' using errcode = 'RL001';
  end if;
  return null;
end;
$$;

-- Imposta una tabella sincronizzata: privilegi minimi, RLS "solo il
-- proprietario" (più una condizione extra, es. per il ciclo), trigger di
-- sincronizzazione, indice per il download incrementale.
-- Usata solo dentro le migrazioni e cancellata alla fine (Parte 6).
-- I trigger "before" di una riga scattano in ordine alfabetico: *_guard (ciclo),
-- *_scrub, *_sync_guard; *_rate_limit scatta dopo l'inserimento.
create or replace procedure public._setup_synced_table(
  p_table text,
  p_extra text default 'true',
  p_daily_limit int default 10000
)
language plpgsql
set search_path = ''
as $$
begin
  execute format('revoke all on table public.%I from anon, authenticated', p_table);
  execute format('grant select on table public.%I to authenticated', p_table);
  execute format('alter table public.%I enable row level security', p_table);

  execute format(
    'create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()) and %s)',
    p_table || '_select_own', p_table, p_extra);
  execute format(
    'create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()) and %s)',
    p_table || '_insert_own', p_table, p_extra);
  execute format(
    'create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid()) and %s) with check (user_id = (select auth.uid()) and %s)',
    p_table || '_update_own', p_table, p_extra, p_extra);

  execute format(
    'create trigger %I before insert or update on public.%I for each row execute function public.sync_guard()',
    p_table || '_sync_guard', p_table);
  execute format(
    'create trigger %I after insert on public.%I for each row execute function public.rate_limit_inserts(%s)',
    p_table || '_rate_limit', p_table, p_daily_limit);
  execute format(
    'create index %I on public.%I (user_id, server_updated_at)',
    p_table || '_sync_idx', p_table);
end;
$$;


-- =============================================================================
-- PARTE 1 · Core rivista: profiles e body_weights
-- =============================================================================

-- Versione dell'informativa sul ciclo: cambiandola, tutti devono ridare il
-- consenso. Deve coincidere con CYCLE_POLICY_VERSION in src/lib/legal.ts.
create or replace function public.current_cycle_policy_version()
returns text
language sql
immutable
set search_path = ''
as $$
  select '2026-10-04'::text;
$$;

create table public.profiles (
  id                      uuid primary key references auth.users (id) on delete cascade,
  -- Nome mostrato nel saluto: lo vede solo l'utente (max 16, come NAME_MAX nell'app).
  display_name            text check (char_length(display_name) <= 16),
  -- Serve alla formula del metabolismo e decide se il Ciclo esiste (vedi can_use_cycle).
  sex                     text check (sex in ('female', 'male')),
  height_cm               numeric(4, 1) check (height_cm between 100 and 250),
  birth_year              smallint check (birth_year between 1900 and 2100),
  birth_month             smallint check (birth_month between 1 and 12),
  activity_level          text check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  goal                    text check (goal in ('lose', 'maintain', 'gain')),
  kcal_goal               int check (kcal_goal between 800 and 6000),
  protein_goal_g          int check (protein_goal_g between 20 and 400),
  goals_source            text not null default 'auto' check (goals_source in ('auto', 'manual')),
  goals_weight_kg         numeric(5, 2) check (goals_weight_kg between 25 and 400),
  -- NUOVO: preferenza dell'interfaccia; i dati restano in kg.
  weight_unit             text not null default 'kg' check (weight_unit in ('kg', 'lb')),
  -- NUOVO: separato dal sesso, così in futuro si può estendere senza cambiare
  -- lo schema. Oggi può essere true solo se sex = 'female' e maggiorenne.
  -- Il client non lo scrive: passa da grant_cycle_consent() / set_cycle_tracking().
  cycle_tracking_enabled  boolean not null default false,
  -- NUOVO: momento dell'ultima cancellazione totale dei dati del ciclo; righe
  -- più vecchie in arrivo da un telefono rimasto offline vengono scartate.
  cycle_wiped_at          timestamptz,
  disclaimer_version      text,
  disclaimer_accepted_at  timestamptz,
  onboarding_completed_at timestamptz,
  -- Fuso del dispositivo, aggiornato dal telefono (es. in viaggio).
  timezone                text not null default 'Europe/Rome' check (char_length(timezone) <= 64),
  plan                    text not null default 'free' check (plan in ('free', 'pro')),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  server_updated_at       timestamptz not null default now()
);

comment on column public.profiles.plan is 'Piano (free/pro). Non modificabile dal client: lo cambierà il futuro webhook di pagamento.';
comment on column public.profiles.cycle_tracking_enabled is 'Accesso al Ciclo. Scritto solo dalle funzioni del consenso; spento in automatico se il sesso non è più female.';

create trigger profiles_sync_guard
  before update on public.profiles
  for each row execute function public.sync_guard();

-- Regole che il client non può aggirare:
--  * età minima 14 anni;
--  * la data di nascita SI PUÒ correggere (un errore di battitura deve avere
--    rimedio, e l'età è comunque dichiarata): per questo le regole sull'età si
--    ricalcolano a ogni scrittura dalla data attuale, e can_use_cycle() la
--    ricalcola a ogni lettura;
--  * sotto i 18 anni niente "dimagrire" né obiettivo calorico: si correggono
--    in silenzio (un errore bloccherebbe la coda di sincronizzazione);
--  * se il sesso non è più female o l'utente non è maggiorenne, il Ciclo si
--    spegne (i dati restano, ma le policy li rendono inaccessibili finché
--    l'utente non sceglie se cancellarli).
create or replace function public.profiles_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_age int;
begin
  v_age := public.age_from_birth(new.birth_year, new.birth_month);
  if v_age is not null and v_age < 14 then
    raise exception 'Per usare l''app devi avere almeno 14 anni.' using errcode = 'P0001';
  end if;
  if v_age is not null and v_age < 18 then
    if new.goal = 'lose' then
      new.goal := 'maintain';
    end if;
    new.kcal_goal := null;
  end if;

  if new.sex is distinct from 'female' or coalesce(v_age, 0) < 18 then
    new.cycle_tracking_enabled := false;
  end if;
  return new;
end;
$$;

create trigger profiles_guard
  before insert or update on public.profiles
  for each row execute function public.profiles_guard();

-- Profilo creato alla registrazione. updated_at = -infinity: così il profilo
-- già compilato sul telefono prima dell'account "vince" al primo caricamento.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, updated_at) values (new.id, '-infinity');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Privilegi: il client NON può scrivere plan, cycle_tracking_enabled,
-- cycle_wiped_at, disclaimer_*, onboarding_completed_at, server_updated_at.
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (
  display_name, sex, height_cm, birth_year, birth_month, activity_level, goal,
  kcal_goal, protein_goal_g, goals_source, goals_weight_kg, weight_unit, timezone, updated_at
) on table public.profiles to authenticated;

alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Peso: una riga per giorno (chiave = utente + giorno).
create table public.body_weights (
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  measured_on       date not null check (measured_on >= '1900-01-01'),
  weight_kg         numeric(5, 2) not null check (weight_kg between 25 and 400),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, measured_on)
);

call public._setup_synced_table('body_weights', p_daily_limit => 2000);
grant insert (measured_on, weight_kg, created_at, updated_at, deleted_at) on table public.body_weights to authenticated;
grant update (weight_kg, updated_at, deleted_at) on table public.body_weights to authenticated;


-- =============================================================================
-- PARTE 2 · Tabelle "semplici" (le prime da sincronizzare, come richiesto)
-- =============================================================================
-- Ordine di prova della sincronizzazione: body_weights → brain_results →
-- workout_sessions; poi le altre.

-- Mente: risultati degli esercizi (oggi lo store "brain-results").
create table public.brain_results (
  id                uuid primary key,
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  game              text not null check (game in ('reaction', 'colors', 'math', 'schulte')),
  variant           text not null check (char_length(variant) <= 40),
  played_at         timestamptz not null,
  played_on         date not null check (played_on >= '2000-01-01'),
  score             double precision not null,
  metrics           jsonb not null default '{}' check (jsonb_typeof(metrics) = 'object' and pg_column_size(metrics) <= 2000),
  routine           boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now()
);

call public._setup_synced_table('brain_results');
grant insert (id, game, variant, played_at, played_on, score, metrics, routine, created_at, updated_at, deleted_at)
  on table public.brain_results to authenticated;
grant update (updated_at, deleted_at) on table public.brain_results to authenticated;

-- Allenamenti (oggi lo store "workouts"). routine_id e le serie arriveranno
-- con la fase D (palestra dettagliata).
create table public.workout_sessions (
  id                uuid primary key,
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  performed_on      date not null check (performed_on >= '2000-01-01'),
  started_at        timestamptz,
  activity_type     text not null check (activity_type in (
    'gym', 'calisthenics', 'crossfit', 'running', 'walking', 'cycling', 'swimming', 'hiit', 'rowing',
    'hiking', 'yoga', 'pilates', 'stretching', 'martialArts', 'dance', 'teamSports', 'racket', 'climbing', 'other')),
  duration_min      smallint not null check (duration_min between 1 and 600),
  intensity         smallint not null check (intensity between 1 and 3),
  notes             text check (char_length(notes) <= 200),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now()
);
create index workout_sessions_user_day on public.workout_sessions (user_id, performed_on desc) where deleted_at is null;

call public._setup_synced_table('workout_sessions');
grant insert (id, performed_on, started_at, activity_type, duration_min, intensity, notes, created_at, updated_at, deleted_at)
  on table public.workout_sessions to authenticated;
grant update (performed_on, started_at, activity_type, duration_min, intensity, notes, updated_at, deleted_at)
  on table public.workout_sessions to authenticated;


-- =============================================================================
-- PARTE 3 · Cibo
-- =============================================================================
-- Registro dei pasti (oggi lo store "food-entries"): copia dei valori al
-- momento della registrazione, così cambiare un alimento non riscrive il passato.
-- food_id / recipe_id e le porzioni si collegheranno nella fase C.
create table public.food_logs (
  id                uuid primary key,
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  logged_on         date not null check (logged_on >= '2000-01-01'),
  meal              text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  food_id           uuid,
  recipe_id         uuid,
  name              text not null check (char_length(name) between 1 and 80),
  quantity          numeric(7, 1) check (quantity > 0 and quantity <= 10000),
  unit              text check (unit in ('g', 'ml', 'piece', 'serving')),
  kcal              numeric(6, 1) not null check (kcal between 0 and 5000),
  protein_g         numeric(5, 1) check (protein_g between 0 and 500),
  carbs_g           numeric(5, 1) check (carbs_g between 0 and 500),
  fat_g             numeric(5, 1) check (fat_g between 0 and 500),
  fiber_g           numeric(5, 1) check (fiber_g between 0 and 200),
  sugar_g           numeric(5, 1) check (sugar_g between 0 and 500),
  salt_g            numeric(5, 2) check (salt_g between 0 and 100),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now(),
  check ((quantity is null) = (unit is null))
);
create index food_logs_user_day on public.food_logs (user_id, logged_on) where deleted_at is null;

-- Limite più alto: il telefono può tenere fino a 10.000 pasti da caricare al primo accesso.
call public._setup_synced_table('food_logs', p_daily_limit => 20000);
grant insert (id, logged_on, meal, food_id, recipe_id, name, quantity, unit, kcal, protein_g, carbs_g, fat_g,
              fiber_g, sugar_g, salt_g, created_at, updated_at, deleted_at)
  on table public.food_logs to authenticated;
grant update (logged_on, meal, food_id, recipe_id, name, quantity, unit, kcal, protein_g, carbs_g, fat_g,
              fiber_g, sugar_g, salt_g, updated_at, deleted_at)
  on table public.food_logs to authenticated;

-- Fase C (solo schema di massima, da dettagliare allora con le stesse regole):
--  * foods (CONDIVISA): valori per 100 g/ml, barcode (8–14 cifre, unico tra i
--    verificati), fibre/zuccheri/sale facoltativi, status pending/verified/hidden,
--    contatori; status e contatori li scrivono solo i trigger; limite 20 al giorno
--    con rate_limit_inserts(20). Campo source ('user' | 'off') + attribuzione
--    quando arriverà il precompilato da Open Food Facts.
--  * food_votes (limite 100 al giorno), food_portions (porzioni per alimento),
--    recipes + recipe_items, favorite_foods, water_logs (una riga al giorno),
--    nutrition_targets (obiettivi per tipo di giorno: allenamento / riposo).


-- =============================================================================
-- PARTE 4 · Check-in giornaliero e diario (una riga al giorno)
-- =============================================================================
-- Unica fonte di umore, energia, fame e sonno: li usano il diario, il ciclo
-- (correlazioni) e gli insight.
-- Pronta per la cifratura end-to-end facoltativa del SOLO testo del diario:
-- content_encryption = 0 → testo in chiaro, cercabile;
-- content_encryption = 1 → content contiene il testo cifrato sul telefono
-- (base64), il server non lo legge e la ricerca non lo indicizza.
create table public.journal_entries (
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_date         date not null check (entry_date >= '1900-01-01'),
  mood               smallint check (mood between 1 and 5),
  energy             smallint check (energy between 1 and 5),
  hunger             smallint check (hunger between 1 and 5),
  sleep_hours        numeric(3, 1) check (sleep_hours between 0 and 24),
  content            text not null default '' check (char_length(content) <= 40000),
  content_encryption smallint not null default 0 check (content_encryption in (0, 1)),
  prompt_key         text check (char_length(prompt_key) <= 40),
  search             tsvector generated always as (
    case when content_encryption = 0 then to_tsvector('simple', content) end
  ) stored,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,
  server_updated_at  timestamptz not null default now(),
  primary key (user_id, entry_date)
);
create index journal_entries_search on public.journal_entries using gin (search);

call public._setup_synced_table('journal_entries', p_daily_limit => 2000);
grant insert (entry_date, mood, energy, hunger, sleep_hours, content, content_encryption, prompt_key,
              created_at, updated_at, deleted_at)
  on table public.journal_entries to authenticated;
grant update (mood, energy, hunger, sleep_hours, content, content_encryption, prompt_key, updated_at, deleted_at)
  on table public.journal_entries to authenticated;


-- =============================================================================
-- PARTE 5 · Ciclo (dati sanitari, art. 9 GDPR)
-- =============================================================================
-- Accesso solo se TUTTO è vero: proprietario dei dati, sex = 'female',
-- maggiorenne, cycle_tracking_enabled, consenso attivo sulla versione corrente
-- dell'informativa. Nessuna vista o statistica aggregata legge queste tabelle,
-- e non ci sono analytics.

create table public.health_consents (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  scope          text not null check (scope = 'cycle'),
  policy_version text not null,
  granted_at     timestamptz not null default now(),
  revoked_at     timestamptz
);
create unique index health_consents_one_active on public.health_consents (user_id, scope) where revoked_at is null;

-- Il client può solo leggere i propri consensi: scrivono le funzioni qui sotto.
revoke all on table public.health_consents from anon, authenticated;
grant select on table public.health_consents to authenticated;
alter table public.health_consents enable row level security;
create policy "health_consents_select_own" on public.health_consents
  for select to authenticated using (user_id = (select auth.uid()));

-- L'unico punto che decide l'accesso al Ciclo nel database
-- (gemello di canUseCycle(profile) nell'app).
create or replace function public.can_use_cycle()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select p.sex = 'female'
       and p.cycle_tracking_enabled
       and public.age_from_birth(p.birth_year, p.birth_month) >= 18
      from public.profiles p
     where p.id = auth.uid()
  ), false)
  and exists (
    select 1 from public.health_consents c
     where c.user_id = auth.uid() and c.scope = 'cycle' and c.revoked_at is null
       and c.policy_version = public.current_cycle_policy_version()
  );
$$;

create table public.cycle_periods (
  id                uuid primary key,
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  start_date        date not null check (start_date >= '1900-01-01'),
  end_date          date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now(),
  check (end_date is null or (end_date >= start_date and end_date - start_date < 15))
);
-- Due inizi uguali non sono ammessi (tra le righe non cancellate). Se due
-- telefoni offline segnano lo stesso inizio, la sincronizzazione unisce le due righe.
create unique index cycle_periods_one_start on public.cycle_periods (user_id, start_date) where deleted_at is null;

-- Registro del giorno. Umore, energia e fame NON stanno qui: sono nel check-in.
create table public.cycle_day_logs (
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date          date not null check (log_date >= '1900-01-01'),
  flow              text check (flow in ('spotting', 'light', 'medium', 'heavy')),
  symptoms          text[] not null default '{}' check (
    cardinality(symptoms) <= 30 and symptoms <@ array[
      'cramps', 'headache', 'bloating', 'fatigue', 'moodSwings', 'acne', 'breastTenderness', 'cravings',
      'backPain', 'nausea', 'insomnia', 'ovulationPain', 'diarrhea', 'constipation', 'dizziness', 'hotFlashes'
    ]::text[]),
  cervical_mucus    text check (cervical_mucus in ('dry', 'sticky', 'creamy', 'watery', 'eggWhite')),
  -- Priorità media della fase B (tutti facoltativi). Rapporti, protezione e
  -- pillola NON sono qui: restano solo sul telefono e non si sincronizzano
  -- (se un giorno serviranno nel cloud: scelta separata con un consenso a parte).
  bbt_celsius       numeric(4, 2) check (bbt_celsius between 34 and 42),
  lh_test           text check (lh_test in ('negative', 'positive')),
  pregnancy_test    text check (pregnancy_test in ('negative', 'positive')),
  notes             text not null default '' check (char_length(notes) <= 1000),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, log_date)
);

call public._setup_synced_table('cycle_periods', '(select public.can_use_cycle())', 2000);
call public._setup_synced_table('cycle_day_logs', '(select public.can_use_cycle())', 2000);

grant insert (id, start_date, end_date, created_at, updated_at, deleted_at) on table public.cycle_periods to authenticated;
grant update (start_date, end_date, updated_at, deleted_at) on table public.cycle_periods to authenticated;
grant insert (log_date, flow, symptoms, cervical_mucus, bbt_celsius, lh_test, pregnancy_test,
              notes, created_at, updated_at, deleted_at)
  on table public.cycle_day_logs to authenticated;
grant update (flow, symptoms, cervical_mucus, bbt_celsius, lh_test, pregnancy_test,
              notes, updated_at, deleted_at)
  on table public.cycle_day_logs to authenticated;

-- Dopo una cancellazione totale, righe vecchie da un telefono rimasto offline
-- non devono far "risorgere" i dati.
create or replace function public.cycle_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_wiped timestamptz;
begin
  select cycle_wiped_at into v_wiped from public.profiles where id = auth.uid();
  if v_wiped is not null and new.updated_at <= v_wiped then
    return null;
  end if;
  return new;
end;
$$;

create trigger cycle_periods_guard before insert or update on public.cycle_periods
  for each row execute function public.cycle_guard();
create trigger cycle_day_logs_guard before insert or update on public.cycle_day_logs
  for each row execute function public.cycle_guard();

-- Consenso esplicito (con versione dell'informativa) e attivazione del Ciclo.
create or replace function public.grant_cycle_consent(p_version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.profiles;
begin
  select * into p from public.profiles where id = auth.uid();
  if not found then
    raise exception 'Non autenticato.' using errcode = '42501';
  end if;
  if p_version is distinct from public.current_cycle_policy_version() then
    raise exception 'Versione dell''informativa non valida.' using errcode = 'P0001';
  end if;
  if p.sex is distinct from 'female' or coalesce(public.age_from_birth(p.birth_year, p.birth_month), 0) < 18 then
    raise exception 'Il monitoraggio del ciclo non è disponibile per questo profilo.' using errcode = 'P0001';
  end if;
  update public.health_consents set revoked_at = now()
   where user_id = auth.uid() and scope = 'cycle' and revoked_at is null;
  insert into public.health_consents (user_id, scope, policy_version) values (auth.uid(), 'cycle', p_version);
  update public.profiles set cycle_tracking_enabled = true where id = auth.uid();
end;
$$;

-- Spegne o riaccende la sezione senza toccare i dati (es. dopo aver cambiato il
-- sesso e scelto di conservarli). Riaccendere richiede comunque le condizioni.
create or replace function public.set_cycle_tracking(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set cycle_tracking_enabled = p_enabled where id = auth.uid();
  -- profiles_guard lo rimette a false se sesso o età non lo permettono.
end;
$$;

-- Cancellazione totale con un tasto: dati cancellati davvero, consenso
-- revocato, sezione spenta.
create or replace function public.delete_cycle_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Non autenticato.' using errcode = '42501';
  end if;
  delete from public.cycle_day_logs where user_id = auth.uid();
  delete from public.cycle_periods where user_id = auth.uid();
  update public.health_consents set revoked_at = now()
   where user_id = auth.uid() and scope = 'cycle' and revoked_at is null;
  update public.profiles set cycle_tracking_enabled = false, cycle_wiped_at = now() where id = auth.uid();
end;
$$;


-- =============================================================================
-- PARTE 6 · Export, pulizia, chiusura
-- =============================================================================

-- Export completo dei propri dati (JSON). Include il ciclo anche se la sezione
-- è spenta: sono comunque dati dell'utente. Il CSV si genera nell'app da questo JSON.
create or replace function public.export_my_data()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'body_weights', (select coalesce(jsonb_agg(to_jsonb(t) - 'user_id'), '[]') from public.body_weights t where t.user_id = auth.uid() and t.deleted_at is null),
    'brain_results', (select coalesce(jsonb_agg(to_jsonb(t) - 'user_id'), '[]') from public.brain_results t where t.user_id = auth.uid() and t.deleted_at is null),
    'workout_sessions', (select coalesce(jsonb_agg(to_jsonb(t) - 'user_id'), '[]') from public.workout_sessions t where t.user_id = auth.uid() and t.deleted_at is null),
    'food_logs', (select coalesce(jsonb_agg(to_jsonb(t) - 'user_id'), '[]') from public.food_logs t where t.user_id = auth.uid() and t.deleted_at is null),
    'journal_entries', (select coalesce(jsonb_agg(to_jsonb(t) - 'user_id' - 'search'), '[]') from public.journal_entries t where t.user_id = auth.uid() and t.deleted_at is null),
    'health_consents', (select coalesce(jsonb_agg(to_jsonb(t) - 'user_id'), '[]') from public.health_consents t where t.user_id = auth.uid()),
    'cycle_periods', (select coalesce(jsonb_agg(to_jsonb(t) - 'user_id'), '[]') from public.cycle_periods t where t.user_id = auth.uid() and t.deleted_at is null),
    'cycle_day_logs', (select coalesce(jsonb_agg(to_jsonb(t) - 'user_id'), '[]') from public.cycle_day_logs t where t.user_id = auth.uid() and t.deleted_at is null)
  );
$$;

-- Testo libero svuotato quando una riga viene cancellata (resta solo il "segnale").
create or replace function public.scrub_deleted_text()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.deleted_at is not null then
    if tg_table_name = 'journal_entries' then
      new.content := '';
    elsif tg_table_name = 'cycle_day_logs' then
      new.notes := '';
    elsif tg_table_name = 'workout_sessions' then
      new.notes := null;
    end if;
  end if;
  return new;
end;
$$;

create trigger journal_entries_scrub before insert or update on public.journal_entries
  for each row execute function public.scrub_deleted_text();
create trigger cycle_day_logs_scrub before insert or update on public.cycle_day_logs
  for each row execute function public.scrub_deleted_text();
create trigger workout_sessions_scrub before insert or update on public.workout_sessions
  for each row execute function public.scrub_deleted_text();

-- Pulizia (con pg_cron, una volta al mese): le righe cancellate da più di 180
-- giorni spariscono davvero. Un telefono rimasto offline più a lungo rifà un
-- download completo invece di quello incrementale.
--   select cron.schedule('purge-tombstones', '0 4 1 * *', $$
--     delete from public.food_logs where deleted_at < now() - interval '180 days';
--     ... (stessa riga per ogni tabella sincronizzata)
--   $$);

revoke execute on function public.can_use_cycle() from public, anon;
revoke execute on function public.grant_cycle_consent(text) from public, anon;
revoke execute on function public.set_cycle_tracking(boolean) from public, anon;
revoke execute on function public.delete_cycle_data() from public, anon;
revoke execute on function public.export_my_data() from public, anon;
grant execute on function public.can_use_cycle() to authenticated;
grant execute on function public.grant_cycle_consent(text) to authenticated;
grant execute on function public.set_cycle_tracking(boolean) to authenticated;
grant execute on function public.delete_cycle_data() to authenticated;
grant execute on function public.export_my_data() to authenticated;

drop procedure public._setup_synced_table(text, text, int);

-- Fase D (solo schema di massima): exercises (catalogo + personalizzati,
-- muscolo, attrezzo, tipo: carichi / corpo libero / a tempo / cardio),
-- routines + routine_exercises (ordine, superset), workout_sets (tipo di serie,
-- reps, kg, secondi, distanza, RPE/RIR, nota; FK composta sessione+utente),
-- body_measurements (circonferenze, una riga al giorno). Le foto dei progressi
-- NON hanno tabelle: restano solo sul telefono.
