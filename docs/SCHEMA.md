# Schema del database

> **Per ora non è in uso:** l'app salva i dati sul dispositivo (vedi README, "Stato attuale").
> Questo è lo schema per quando arriveranno account e Supabase (DA_FARE.md, sezione 1).
> Da aggiungere allora: `brain_results` per il modulo Mente (stessi campi di `brainResultSchema` in `src/lib/brain/history.ts`).

Postgres su Supabase. Le migrazioni stanno in `supabase/migrations/` e si eseguono in ordine di nome.
Stato: ✅ creata · ⏳ arriverà con il modulo indicato.

## Convenzioni

- Ogni tabella privata: `user_id uuid not null default auth.uid()` → `auth.users` con `ON DELETE CASCADE`; RLS attiva con policy `user_id = auth.uid()`.
- Il client non scrive mai `user_id`: lo mette il default, e i privilegi di colonna non lo includono.
- Su ogni tabella si parte da `revoke all ... from anon, authenticated` e si concede solo il necessario.
- I valori derivati (streak, record, 1RM, peso suggerito, stallo, fase del ciclo, avvisi) si **calcolano**, non si salvano.
- Le funzioni `SECURITY DEFINER` hanno `set search_path = ''`.
- I messaggi d'errore dei trigger sono in italiano (`errcode P0001`) e si possono mostrare all'utente.

## Relazioni

```
auth.users 1─1 profiles
auth.users 1─N body_weights · journal_entries · workout_sessions · workout_sets · exercises (personalizzati)
              food_logs · saved_meals · food_votes · health_consents · cycle_periods
              cycle_day_logs · weekly_insights · foods (created_by, SET NULL)
workout_sessions 1─N workout_sets N─1 exercises
foods 1─N food_votes · food_logs (SET NULL) · saved_meal_items
saved_meals 1─N saved_meal_items
```

## Core ✅ (`20261003090000_core.sql`)

### `profiles`
Una riga per utente, creata dal trigger `on_auth_user_created`.

| Colonna | Tipo | Note |
|---|---|---|
| `id` | uuid PK → auth.users | |
| `display_name` | text ≤ 50 | |
| `sex` | `female` / `male` | serve solo per la formula del metabolismo |
| `height_cm` | numeric 100–250 | |
| `birth_year`, `birth_month` | smallint | non modificabili dopo l'inserimento |
| `activity_level` | `sedentary` … `very_active` | |
| `goal` | `lose` / `maintain` / `gain` | `lose` vietato sotto i 18 anni |
| `kcal_goal` | int 800–6000 | forzato a null sotto i 18 anni |
| `protein_goal_g` | int 20–400 | |
| `goals_source` | `auto` / `manual` | se `manual`, non si propone il ricalcolo |
| `goals_weight_kg` | numeric | peso usato nell'ultimo calcolo (soglia di ricalcolo ±2 kg) |
| `disclaimer_version`, `disclaimer_accepted_at` | | scritti solo da `accept_disclaimer()` |
| `onboarding_completed_at` | timestamptz | scritto solo da `complete_onboarding()` |
| `timezone` | text | default `Europe/Rome` |
| `plan` | `free` / `pro` | **non** modificabile dal client |

Privilegi del client: `SELECT`, più `UPDATE` sulle sole colonne del profilo e degli obiettivi. Niente `INSERT` né `DELETE`.
Trigger `profiles_guard`: età minima 14 anni, data di nascita bloccata, regole per i minorenni.

### `body_weights`
`id`, `user_id`, `measured_on` (date), `weight_kg` (25–400), `UNIQUE(user_id, measured_on)`.

### Funzioni
| Funzione | Chi la chiama | Cosa fa |
|---|---|---|
| `age_from_birth(year, month)` | interna | età prudente (nel mese del compleanno conta come non compiuto); stessa logica in `src/lib/age.ts` |
| `current_disclaimer_version()` | interna | versione corrente del disclaimer (= `DISCLAIMER_VERSION` in `src/lib/legal.ts`) |
| `accept_disclaimer(p_version)` | client | registra l'accettazione con l'ora del server |
| `complete_onboarding()` | client | chiude l'onboarding solo se i dati obbligatori ci sono |
| `current_user_is_adult()` | policy | usata dal modulo ciclo |

## Diario ⏳
`journal_entries`: `id`, `user_id`, `entry_date`, `content` (≤ 20.000), `mood` 1–5, `energy` 1–5, `sleep_hours` 0–24, `prompt_key`, `search` (tsvector italiano, GIN), `UNIQUE(user_id, entry_date)`. È l'unica fonte dell'energia, anche per il ciclo.

## Allenamento ⏳
- `exercises`: `owner_id` null = catalogo (~30 nel seed); `name`, `muscle_group`, `equipment`.
- `workout_sessions`: `performed_on`, `started_at`, `notes`.
- `workout_sets`: `session_id`, `exercise_id`, `position`, `target_reps`, `reps`, `weight_kg`, `rpe` 1–10, `execution_note`. Una FK composta `(session_id, user_id)` impedisce di aggiungere serie alle sessioni di altri.
- Vista `exercise_session_stats` (`security_invoker`): peso massimo, volume, 1RM Epley, ripetizioni completate, RPE massimo per esercizio e sessione.

## Alimentazione ⏳
- `foods` (**condivisa**): valori per 100 g, porzione, `status` (`pending`/`verified`/`hidden`), contatori. Controlli: |kcal − (4P+4C+9G)| ≤ max(20%, 10 kcal) e P+C+G ≤ 100. Stato e contatori li scrivono solo i trigger. L'autore può modificare solo finché l'alimento non è verificato, e ogni modifica azzera i voti. Il client non può cancellare. Limite: 20 alimenti al giorno per utente.
- `food_votes`: PK `(food_id, user_id)`, visibili solo a chi li ha dati, mai sul proprio alimento, massimo 100 al giorno.
- `food_logs`: copia di nome, kcal e macro al momento della registrazione; `food_id` null per l'inserimento manuale rapido.
- `saved_meals`, `saved_meal_items`.
- Seed: ~45 alimenti comuni, verificati e senza autore.

## Insight ⏳
`weekly_insights`: `week_start`, `generated_at`, `engine` (`rules`), `items` jsonb, `UNIQUE(user_id, week_start)`. Non contiene mai dati del ciclo.

## Ciclo ⏳ (dati sanitari, art. 9 GDPR; solo maggiorenni)
- `health_consents`: `scope` (`cycle`), `policy_version`, `granted_at`, `revoked_at`. Il client può solo leggere; scrivono `grant_cycle_consent()` e `delete_cycle_data()`.
- `cycle_periods`: `start_date`, `end_date`.
- `cycle_day_logs`: `log_date`, `symptoms` (lista chiusa), `hunger` 1–5, `notes`, `UNIQUE(user_id, log_date)`.
- Policy: proprietario **e** `has_cycle_consent()` **e** `current_user_is_adult()`.

## Futuro (solo documentato)
- `subscriptions`: stato dell'abbonamento Stripe; aggiornata dal webhook con la chiave service_role, che a sua volta aggiorna `profiles.plan`.
- `ai_usage`: utilizzo per utente e mese, per i limiti di piano.
- `ai_consents`: consenso separato per inviare all'AI il testo del diario e i dati del ciclo.
