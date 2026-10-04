-- =============================================================================
-- 0003 · Check-in giornaliero e diario
-- =============================================================================
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


