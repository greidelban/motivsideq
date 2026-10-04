# Da fare: attività secondarie

Cose rimandate per concentrarsi sull'app. Nessuna blocca lo sviluppo delle funzioni: si riprendono quando l'app è pronta per avere account e andare online.

## 1. Account e backend (Supabase)
Il login era già pronto ed è stato messo da parte in `archivio/login/` (escluso da build, typecheck e lint).
- [ ] Creare il progetto Supabase gratuito (regione **Central EU (Frankfurt)**).
- [ ] Copiare URL e chiavi in `.env.local` (modello: `archivio/login/.env.example`). La chiave `service_role` va solo nel file, mai in chat né in variabili `NEXT_PUBLIC_`.
- [ ] Eseguire le migrazioni di `supabase/migrations/` nello SQL Editor, in ordine.
- [ ] *Authentication → URL Configuration*: Site URL `http://localhost:3000` e Redirect URL `http://localhost:3000/auth/confirm`.
- [ ] *Authentication → Emails*: template con `token_hash`.
  - Confirm signup: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/oggi`
  - Reset password: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`
- [ ] Lunghezza minima della password: 8. "Confirm email" attivo.
- [ ] SMTP proprio (Resend o Brevo, piano gratuito): quello integrato manda email solo ai membri del progetto.
- [ ] Rimettere in `src/` il codice di `archivio/login/` e reinstallare `@supabase/supabase-js`, `@supabase/ssr` e `server-only`. Poi:
  - riunire il proxy di sola CSP con quello completo (`archivio/login/src/proxy.ts`);
  - ripristinare `requireUser()` nel layout `(app)` e le pagine `(auth)`.
- [ ] **Migrare i dati locali**: al primo accesso, importare nel database quello che è nel `localStorage` (store definiti con `defineStore`, chiavi `ritmo:v1:*`).
- [ ] Aggiungere le tabelle dei moduli nuovi (es. `brain_results` per Mente) a migrazioni e `docs/SCHEMA.md`.
- [ ] Ricordarsi che il piano gratuito mette in pausa il progetto dopo 7 giorni senza attività.
- [ ] Creare la migrazione di Salute con l'SQL della sezione 1b.

## 1b. SQL per Salute (profilo, allenamenti, cibo, ciclo)
Oggi questi dati stanno nel `localStorage` (store `profile`, `body-weights`, `workouts`, `food-entries`, `cycle-*`).
- **Profilo:** altezza, data di nascita (mese e anno), sesso, attività e obiettivo ci sono già in `profiles`, il peso in `body_weights` (migrazione core). Da store a colonne: `heightCm` → `height_cm`, `birthYear`/`birthMonth` → `birth_year`/`birth_month`, `activityLevel` → `activity_level`, `kg` → `weight_kg`, `day` → `measured_on`.
- **Da aggiungere** in una nuova migrazione (es. `supabase/migrations/2026100xxxxxxx_health.sql`), poi aggiornare `docs/SCHEMA.md`:

```sql
-- Allenamenti: un tipo di attività per sessione (stessi id di WORKOUT_TYPES in src/lib/health/workouts.ts).
-- Le kcal non si salvano: si calcolano (MET × peso × ore).
create table public.workout_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  performed_on  date not null default current_date,
  activity_type text not null check (activity_type in (
    'gym', 'calisthenics', 'crossfit', 'running', 'walking', 'cycling', 'swimming', 'hiit', 'rowing',
    'hiking', 'yoga', 'pilates', 'stretching', 'martialArts', 'dance', 'teamSports', 'racket', 'climbing', 'other')),
  duration_min  smallint not null check (duration_min between 1 and 600),
  intensity     smallint not null check (intensity between 1 and 3),
  notes         text check (char_length(notes) <= 200),
  created_at    timestamptz not null default now()
);
create index workout_sessions_user_day on public.workout_sessions (user_id, performed_on desc);

-- Cibo: inserimento manuale (food_id resta per quando arriverà la tabella condivisa foods).
create table public.food_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  logged_on  date not null default current_date,
  meal       text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  food_id    uuid,
  name       text not null check (char_length(name) between 1 and 80),
  kcal       numeric(6, 1) not null check (kcal between 0 and 5000),
  protein_g  numeric(5, 1) check (protein_g between 0 and 500),
  carbs_g    numeric(5, 1) check (carbs_g between 0 and 500),
  fat_g      numeric(5, 1) check (fat_g between 0 and 500),
  created_at timestamptz not null default now()
);
create index food_logs_user_day on public.food_logs (user_id, logged_on);

-- Ciclo (art. 9 GDPR, solo maggiorenni con consenso).
create table public.health_consents (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  scope          text not null check (scope = 'cycle'),
  policy_version text not null,
  granted_at     timestamptz not null default now(),
  revoked_at     timestamptz
);

create table public.cycle_periods (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  start_date date not null,
  end_date   date check (end_date >= start_date and end_date - start_date < 15),
  unique (user_id, start_date)
);

create table public.cycle_day_logs (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date date not null,
  flow     text check (flow in ('spotting', 'light', 'medium', 'heavy')),
  symptoms text[] not null default '{}' check (symptoms <@ array[
    'cramps', 'headache', 'bloating', 'fatigue', 'moodSwings', 'acne',
    'breastTenderness', 'cravings', 'backPain', 'nausea']::text[]),
  unique (user_id, log_date)
);

create or replace function public.has_cycle_consent()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.health_consents
                  where user_id = auth.uid() and scope = 'cycle' and revoked_at is null);
$$;
revoke execute on function public.has_cycle_consent() from public, anon;
grant execute on function public.has_cycle_consent() to authenticated;

-- Privilegi e RLS: stesso schema di body_weights (revoke all, poi solo il necessario).
-- workout_sessions e food_logs: policy "user_id = (select auth.uid())" per select/insert/update/delete.
-- cycle_periods e cycle_day_logs: in più "and public.has_cycle_consent() and public.current_user_is_adult()".
-- health_consents: il client legge soltanto; scrivono grant_cycle_consent() e delete_cycle_data()
-- (SECURITY DEFINER, quest'ultima cancella periodi e log e imposta revoked_at).
```

## 2. Privacy e aspetti legali
- [ ] Compilare titolare e contatto in `src/app/privacy/page.tsx` (ora sono segnaposto `[...]`).
- [ ] Con gli account: passare all'informativa completa in `archivio/login/src/app/privacy/page.tsx` e aggiornarla con i moduli nuovi.
- [ ] Far rivedere informativa, disclaimer e consenso per i dati del ciclo (art. 9 GDPR) da un consulente privacy prima del lancio pubblico.
- [ ] Verificare le regole per i minori di 14-17 anni (consenso digitale in Italia: 14 anni).

## 3. Account: funzioni da completare
- [ ] Export dei dati (JSON unico o CSV per tabella). In modalità locale si può già fare dal `localStorage`.
- [ ] Cancellazione account (route server con `service_role`, tutto a cascata).
- [ ] Rate limit sulla creazione di alimenti e voti (già previsto via trigger nello schema).
- [ ] Test automatici delle regole RLS (un utente non deve vedere i dati di un altro).

## 4. Pubblicazione
- [x] Git inizializzato e pubblicato su GitHub: https://github.com/greidelban/motivsideq (pubblico).
- [ ] Scegliere l'hosting (es. Vercel, piano gratuito) e un dominio; HTTPS obbligatorio per la PWA.
- [ ] Impostare le variabili d'ambiente in produzione e aggiungere l'URL di produzione ai Redirect URLs di Supabase.
- [ ] Scegliere il nome definitivo dell'app (ora "Ritmo", in `src/lib/app.ts`) e rifare l'icona se serve (`npm run icons`).

## 5. PWA e qualità
- [ ] Cache offline delle pagine e dei file statici nel service worker, così i giochi del mattino funzionano anche senza rete (oggi c'è solo la pagina "Sei offline").
- [ ] Notifica push facoltativa "È ora del risveglio" la mattina.
- [ ] Prova reale su iPhone e Android installando la PWA: vibrazione al tocco, tastierino, aree sicure.
- [ ] Luce viva su telefoni veri: fluidità e consumo di batteria (eventualmente un livello "leggero" automatico sui dispositivi lenti, come in pathwyr).
- [ ] Interruttore in Impostazioni per spegnere la luce viva (oggi si adatta solo a "riduci movimento").

## 6. Lingue
- [ ] Far rivedere da madrelingua i testi inglesi, soprattutto disclaimer e privacy (oggi sono traduzioni mie).
- [ ] Per ogni nuova lingua: disclaimer e informativa vanno rivisti anche dal punto di vista legale del paese.
- [ ] Manifest PWA per lingua (oggi nome e descrizione sono solo in inglese).

## 7. Più avanti (solo predisposti)
- [ ] Chat in incognito (`/chat`, tasto accanto alle Impostazioni): oggi c'è solo la schermata, col lucchetto. Si sblocca con l'abbonamento: in `src/lib/entitlements.ts` è `chat: ["pro"]`, quindi il lucchetto sparisce da solo per chi ha il piano pro (per aprirla a tutti basta aggiungere `"free"`). Serve decidere il motore (le regole del progetto vietano AI/LLM finché non si cambia idea); i messaggi devono restare solo in memoria, mai salvati.
- [ ] Abbonamento con Stripe: tabella `subscriptions`, webhook che aggiorna `profiles.plan`, `can()` in `src/lib/entitlements.ts`.
- [ ] AI lato server: tabella `ai_usage`, controllo del piano, consenso separato per diario e ciclo.
