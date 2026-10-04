# Da fare

Fase 2 (piano approvato): A1 dati pronti al cloud ✅ → E ciclo solo per le donne ✅ → **A2 Supabase** → check-in giornaliero → B ciclo → D allenamento → C alimentazione.

## 1. Account e backend (Supabase): fase A2
Il login era già pronto ed è stato messo da parte in `archivio/login/` (escluso da build, typecheck e lint).
- [ ] Creare il progetto Supabase gratuito (regione **Central EU (Frankfurt)**).
- [ ] Copiare URL e chiavi in `.env.local` (modello: `archivio/login/.env.example`). La chiave `service_role` va solo nel file, mai in chat né in variabili `NEXT_PUBLIC_`.
- [ ] Trasformare `supabase/proposta/schema_v2.sql` in migrazioni (sezione 1b) ed eseguirle nello SQL Editor, in ordine.
- [ ] *Authentication → URL Configuration*: Site URL `http://localhost:3000` e Redirect URL `http://localhost:3000/auth/confirm`.
- [ ] *Authentication → Emails*: template con `token_hash`.
  - Confirm signup: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/today`
  - Reset password: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`
- [ ] Lunghezza minima della password: 8. "Confirm email" attivo.
- [ ] Accesso con Google (gratuito). Accesso con Apple: codice pronto, da attivare solo quando l'app andrà sugli store (serve l'Apple Developer Program, 99 $ l'anno).
- [ ] SMTP proprio (Resend o Brevo, piano gratuito): quello integrato manda email solo ai membri del progetto.
- [ ] Rimettere in `src/` il codice di `archivio/login/` e reinstallare `@supabase/supabase-js`, `@supabase/ssr` e `server-only`. Poi:
  - riunire il proxy di sola CSP con quello completo (`archivio/login/src/proxy.ts`);
  - il login resta facoltativo: l'app funziona anche senza account.
- [ ] **Sincronizzazione** (i record locali sono già pronti: `localDb.dirty(nome)`):
  - prima su tre tabelle semplici (`body_weights`, `brain_results`, `workout_sessions`), poi sulle altre;
  - invio in blocchi con "upsert", poi download di ciò che è cambiato (`server_updated_at`, con un minuto di sovrapposizione);
  - indicatore di stato discreto (sincronizzato / in coda / offline);
  - limite giornaliero raggiunto (codice `RL001`): i dati restano in coda, messaggio comprensibile, nuovo tentativo il giorno dopo;
  - telefono offline da più di 180 giorni: **prima** invia le modifiche locali, **poi** riscarica tutto; messaggio chiaro all'utente; test dedicato;
  - consenso al ciclo e cancellazione totale (`cycle-wiped-at`) si inviano con le funzioni del database, non come righe.
- [ ] **Primo accesso:** caricare i dati già sul telefono senza duplicarli né perderli (gli id sono già UUID), con test.
- [ ] Pulizia mensile delle righe cancellate da più di 180 giorni (pg_cron), anche sul telefono dopo l'invio.
- [ ] Test dello schema in Vitest: `supabase/proposta/schema_v2.check.mjs` con PGlite come dipendenza di sviluppo.
- [ ] Blocco app facoltativo (PIN o biometria con WebAuthn) per diario e ciclo.
- [ ] Ricordarsi che il piano gratuito mette in pausa il progetto dopo 7 giorni senza attività.

## 1b. Schema v2 (sincronizzazione, ciclo solo per le donne, Salute)
Approvato. È in `supabase/proposta/schema_v2.sql` (fuori da `migrations/`: non si esegue). Provato su un Postgres in memoria con 31 controlli: `node supabase/proposta/schema_v2.check.mjs` (serve `@electric-sql/pglite`).
- [x] Approvare la proposta.
- [ ] Riscrivere `profiles` e `body_weights` nella migrazione core e dividere il resto in migrazioni nuove.

Decisioni principali:
- **ID e sincronizzazione:** UUID generati sul telefono; `created_at`, `updated_at` (ora del telefono, decide i conflitti: vince la modifica più recente), `deleted_at` (cancellazione morbida), `server_updated_at` (solo server, per scaricare le novità).
- **Righe "una al giorno"** (peso, check-in/diario, registro del ciclo): chiave (utente, giorno) invece dell'id, così due telefoni offline non creano doppioni.
- **Giorni** calcolati sul telefono nel fuso dell'utente: nessuna colonna giorno usa `current_date` del server (UTC).
- **Unità** sempre metriche; `profiles.weight_unit` (kg/lb) è solo una preferenza dell'interfaccia.
- **Ciclo:** accesso solo con sesso donna + maggiorenne + `cycle_tracking_enabled` + consenso attivo sulla versione corrente dell'informativa (`can_use_cycle()`). Cambiare sesso spegne la sezione senza cancellare i dati; `delete_cycle_data()` cancella tutto davvero e impedisce che righe vecchie tornino da un telefono offline.
- **Data di nascita** correggibile: le regole per i minorenni si ricalcolano a ogni scrittura ("dimagrire" diventa "mantenere", niente obiettivo calorico).
- **Rapporti, protezione e pillola** non sono nello schema: restano solo sul telefono.
- **Sicurezza:** niente DELETE dal client; colonne protette (`plan`, consensi, stato del ciclo); limiti giornalieri di scrittura con un contatore che conta solo le righe davvero nuove (un invio ritentato non lo consuma due volte); errore `RL001` quando il limite è raggiunto.
- **Diario:** pronto per la cifratura facoltativa del solo testo (`content_encryption`), non implementata.
- **Export:** `export_my_data()` in JSON (il CSV si genera nell'app).

## 2. Privacy e aspetti legali
- [ ] Compilare titolare e contatto in `src/app/privacy/page.tsx` (ora sono segnaposto `[...]`).
- [ ] Con gli account: passare all'informativa completa in `archivio/login/src/app/privacy/page.tsx` e aggiornarla con i moduli nuovi.
- [ ] Far rivedere informativa, disclaimer e consenso per i dati del ciclo (art. 9 GDPR) da un consulente privacy prima del lancio pubblico.
- [ ] Verificare le regole per i minori di 14-17 anni (consenso digitale in Italia: 14 anni).

## 3. Account: funzioni da completare
- [x] Export e import JSON in locale (Impostazioni → Copia di sicurezza).
- [ ] Export anche in CSV e dal server (`export_my_data()`).
- [ ] Cancellazione account (route server con `service_role`, tutto a cascata).
- [ ] Rate limit sulla creazione di alimenti e voti (già previsto via trigger nello schema).
- [ ] Test automatici delle regole RLS (un utente non deve vedere i dati di un altro).

## 4. Pubblicazione
- [x] Git inizializzato e pubblicato su GitHub: https://github.com/greidelban/motivsideq (pubblico).
- [ ] Scegliere l'hosting (es. Vercel, piano gratuito) e un dominio; HTTPS obbligatorio per la PWA.
- [ ] Impostare le variabili d'ambiente in produzione e aggiungere l'URL di produzione ai Redirect URLs di Supabase.
- [x] Nome dell'app: **GetControl** (`src/lib/app.ts`).
- [ ] Rifare l'icona se serve (`npm run icons`) e scegliere il dominio.

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
