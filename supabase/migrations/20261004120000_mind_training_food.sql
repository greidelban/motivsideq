-- =============================================================================
-- 0002 · Mente, allenamenti, cibo (tabelle sincronizzate)
-- =============================================================================
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


