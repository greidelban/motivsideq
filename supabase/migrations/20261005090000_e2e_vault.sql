-- =============================================================================
-- 0009 · Cifratura end-to-end: il server non legge più i dati degli utenti
-- =============================================================================
-- Decisione dell'utente (4/10/2026): i dati nel cloud devono essere illeggibili
-- per chi gestisce il servizio. Il telefono cifra ogni elemento con una chiave
-- che solo l'utente possiede (src/lib/crypto/vault.ts); qui arrivano soltanto:
--   * un id casuale (HMAC), che non rivela né il tipo di dato né il giorno;
--   * il testo cifrato;
--   * le date di modifica e cancellazione (servono alla sincronizzazione).
-- Restano leggibili solo email e date di accesso (Supabase Auth) e il piano.
-- Le regole su età e Ciclo le applica ora solo l'app: il server non conosce
-- più sesso né data di nascita.
-- Il cloud fa parte dell'abbonamento: scrivere richiede plan = 'pro'; leggere
-- (per recuperare i propri dati) resta sempre possibile.
-- Prova: src/lib/storage/schema.test.ts.

-- -----------------------------------------------------------------------------
-- 1. Via le tabelle con dati in chiaro (contenevano solo dati di prova)
-- -----------------------------------------------------------------------------
drop function public.export_my_data();
drop function public.delete_cycle_data();
drop function public.set_cycle_tracking(boolean);
drop function public.grant_cycle_consent(text);
drop table public.cycle_day_logs;
drop table public.cycle_periods;
drop function public.cycle_guard();
drop table public.health_consents;
drop function public.can_use_cycle();
drop table public.journal_entries;
drop table public.food_logs;
drop table public.workout_sessions;
drop table public.brain_results;
drop function public.complete_onboarding();
drop table public.body_weights;
drop function public.scrub_deleted_text();
drop function public.accept_disclaimer(text);
drop function public.current_user_is_adult();
drop procedure public._setup_synced_table(text, text, int, int);

-- Profilo: resta solo il piano. Nome, sesso, data di nascita, altezza, obiettivi
-- e preferenze viaggiano cifrati come gli altri dati.
drop trigger profiles_guard on public.profiles;
drop function public.profiles_guard();
drop trigger profiles_sync_guard on public.profiles;
drop policy "profiles_update_own" on public.profiles;
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
alter table public.profiles
  drop column display_name,
  drop column sex,
  drop column height_cm,
  drop column birth_year,
  drop column birth_month,
  drop column activity_level,
  drop column goal,
  drop column kcal_goal,
  drop column protein_goal_g,
  drop column goals_source,
  drop column goals_weight_kg,
  drop column weight_unit,
  drop column cycle_tracking_enabled,
  drop column cycle_wiped_at,
  drop column disclaimer_version,
  drop column disclaimer_accepted_at,
  drop column onboarding_completed_at,
  drop column timezone;
comment on column public.profiles.plan is 'Piano (free/pro). Non modificabile dal client: lo cambierà la verifica degli acquisti in-app.';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

drop function public.age_from_birth(int, int, date);
drop function public.current_disclaimer_version();
drop function public.current_cycle_policy_version();

delete from public.write_counters;
delete from public.row_totals;

-- -----------------------------------------------------------------------------
-- 2. Abbonamento
-- -----------------------------------------------------------------------------
create or replace function public.has_cloud()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.plan = 'pro' from public.profiles p where p.id = auth.uid()), false);
$$;
revoke execute on function public.has_cloud() from public, anon;
grant execute on function public.has_cloud() to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Chiave impacchettata
-- -----------------------------------------------------------------------------
-- La chiave dati cifrata con il codice di recupero dell'utente. Senza il codice
-- è inutilizzabile: il server non può aprirla.
create table public.user_keys (
  user_id     uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  -- Impronta della chiave: le righe cifrate con un'altra chiave vengono rifiutate.
  key_id      text not null check (key_id ~ '^[0-9a-f]{32}$'),
  wrapped_key text not null check (wrapped_key ~ '^v1\.[A-Za-z0-9+/=]{40,200}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
revoke all on table public.user_keys from anon, authenticated;
grant select on table public.user_keys to authenticated;
grant insert (key_id, wrapped_key) on table public.user_keys to authenticated;
-- Un codice di recupero nuovo cambia solo l'involucro; la chiave resta la stessa.
grant update (wrapped_key) on table public.user_keys to authenticated;
alter table public.user_keys enable row level security;
create policy "user_keys_select_own" on public.user_keys
  for select to authenticated using (user_id = (select auth.uid()));
create policy "user_keys_insert_own" on public.user_keys
  for insert to authenticated with check (user_id = (select auth.uid()) and (select public.has_cloud()));
create policy "user_keys_update_own" on public.user_keys
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create trigger user_keys_updated_at before update on public.user_keys
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. Caveau: tutte le righe cifrate dell'utente
-- -----------------------------------------------------------------------------
create table public.vault_records (
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id                text not null check (id ~ '^[0-9a-f]{64}$'),
  key_id            text not null,
  payload           text not null check (payload ~ '^v1\.' and char_length(payload) <= 262144),
  -- Ora di arrivo sul server (non quella di creazione sul telefono, che è cifrata).
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index vault_records_sync_idx on public.vault_records (user_id, server_updated_at);

revoke all on table public.vault_records from anon, authenticated;
grant select on table public.vault_records to authenticated;
-- id compreso nell'update: l'upsert del telefono rimanda tutte le colonne (stesso valore).
grant insert (id, key_id, payload, updated_at, deleted_at) on table public.vault_records to authenticated;
grant update (id, key_id, payload, updated_at, deleted_at) on table public.vault_records to authenticated;
alter table public.vault_records enable row level security;
create policy "vault_records_select_own" on public.vault_records
  for select to authenticated using (user_id = (select auth.uid()));
create policy "vault_records_insert_own" on public.vault_records
  for insert to authenticated with check (user_id = (select auth.uid()) and (select public.has_cloud()));
create policy "vault_records_update_own" on public.vault_records
  for update to authenticated
  using (user_id = (select auth.uid()) and (select public.has_cloud()))
  with check (user_id = (select auth.uid()) and (select public.has_cloud()));

-- Vince l'ultima modifica, date nel futuro corrette (stessa regola di prima).
create trigger vault_records_sync_guard before insert or update on public.vault_records
  for each row execute function public.sync_guard();

-- Righe cifrate con una chiave diversa da quella attuale (dispositivo rimasto
-- indietro dopo un "ricomincia da zero"): rifiutate, l'app chiede il codice.
-- Prima però il piano: senza abbonamento la risposta è sempre "non incluso"
-- (questo trigger scatta prima delle policy).
create or replace function public.vault_key_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.has_cloud() then
    raise exception 'Il cloud non è incluso nel piano.' using errcode = '42501';
  end if;
  if new.key_id is distinct from (select k.key_id from public.user_keys k where k.user_id = new.user_id) then
    raise exception 'Chiave di cifratura non più valida.' using errcode = 'KY001';
  end if;
  return new;
end;
$$;
create trigger vault_records_key_guard before insert or update on public.vault_records
  for each row execute function public.vault_key_guard();

-- Righe nuove al giorno e in totale (stessi contatori di prima).
create trigger vault_records_rate_limit after insert on public.vault_records
  for each row execute function public.rate_limit_inserts(50000, 500000);

-- Spazio occupato per utente: tetto di 256 MB (anni di dati ne occupano pochi MB).
create table public.vault_usage (
  user_id uuid primary key references auth.users (id) on delete cascade,
  bytes   bigint not null default 0
);
revoke all on table public.vault_usage from anon, authenticated;
alter table public.vault_usage enable row level security;

create or replace function public.vault_usage_track()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid;
  v_delta bigint;
  v_bytes bigint;
begin
  if tg_op = 'INSERT' then
    v_user := new.user_id;
    v_delta := octet_length(new.payload);
  elsif tg_op = 'UPDATE' then
    v_user := new.user_id;
    v_delta := octet_length(new.payload) - octet_length(old.payload);
  else
    v_user := old.user_id;
    v_delta := -octet_length(old.payload);
  end if;
  insert into public.vault_usage (user_id, bytes) values (v_user, greatest(v_delta, 0))
  on conflict (user_id) do update set bytes = greatest(public.vault_usage.bytes + v_delta, 0)
  returning bytes into v_bytes;
  if v_delta > 0 and auth.uid() is not null and v_bytes > 268435456 then
    raise exception 'Spazio dell''account esaurito.' using errcode = 'RL002';
  end if;
  return null;
end;
$$;
create trigger vault_records_usage after insert or update or delete on public.vault_records
  for each row execute function public.vault_usage_track();

-- -----------------------------------------------------------------------------
-- 5. Ricominciare da zero (codice perso e nessun dispositivo con la chiave)
-- -----------------------------------------------------------------------------
-- Cancella davvero le righe cifrate e la chiave: i dati ancora presenti sui
-- dispositivi si ricaricano con una chiave nuova.
create or replace function public.reset_vault()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Non autenticato.' using errcode = '42501';
  end if;
  delete from public.vault_records where user_id = auth.uid();
  delete from public.user_keys where user_id = auth.uid();
  update public.row_totals set count = 0 where user_id = auth.uid() and table_name = 'vault_records';
end;
$$;
revoke execute on function public.reset_vault() from public, anon;
grant execute on function public.reset_vault() to authenticated;
