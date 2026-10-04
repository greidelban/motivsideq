# Da fare

Fase 2 (piano approvato): A1 dati pronti al cloud ✅ → E ciclo solo per le donne ✅ → **A2 Supabase** → check-in giornaliero → B ciclo → D allenamento → C alimentazione.

## 1. Account e backend (Supabase): fase A2
Progetto Supabase `idghdzlznxhqlpaqdmfy` (Central EU, Frankfurt). Chiavi in `.env.local` (escluso da git): l'app usa la chiave **publishable**.
Il login si fa nel browser con `@supabase/supabase-js` (`src/lib/supabase/client.ts`, pagine `/account` e `/auth/confirm`). Il vecchio codice in `archivio/login/` (cookie lato server, testi in italiano) non serve più.
- [x] Progetto Supabase gratuito creato (regione **Central EU (Frankfurt)**).
- [x] URL e chiavi in `.env.local` (modello: `archivio/login/.env.example`).
- [ ] **Sicurezza: la chiave `service_role` è stata incollata in chat il 4/10/2026.** Sostituirla:
  - *Project Settings → API Keys*: creare una chiave **secret** (`sb_secret_…`) e metterla in `.env.local` al posto di `SUPABASE_SERVICE_ROLE_KEY`;
  - poi *Legacy API keys → Disable* (disattiva le vecchie anon e service_role). L'app non ne risente: usa la publishable.
- [x] Schema v2 trasformato in migrazioni (`supabase/migrations/`, 5 file).
- [x] Migrazioni eseguite nello SQL Editor il 4/10/2026 con `supabase/setup-completo.sql` (`npm run db:bundle`). Verificato dall'esterno: 10 tabelle, accesso negato agli anonimi, funzioni del ciclo protette.
- [ ] *Authentication → URL Configuration*: Site URL `http://localhost:3000` e Redirect URL `http://localhost:3000/auth/confirm`.
- [ ] *Authentication → Emails*: template con `token_hash`.
  - Confirm signup: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`
  - Reset password: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`
- [ ] Lunghezza minima della password: 8. "Confirm email" attivo.
- [x] Login nel browser: accedi, crea account, password dimenticata, conferma via email. Facoltativo: senza account l'app resta locale.
- [ ] Provare registrazione e accesso con un'email vera (dopo aver impostato URL e template qui sopra).
- [ ] Accesso con Google e con Apple **al lancio** (vedi sezione 4: pulsanti nativi nell'app iOS).
- [ ] SMTP proprio (Resend o Brevo, piano gratuito): quello integrato manda poche email all'ora.
- [ ] Eseguire nello SQL Editor la migrazione `20261004130000_upsert_grants.sql` (permessi per l'invio dal telefono): `npm run db:bundle -- 20261004130000` la mette da sola in `supabase/setup-completo.sql`.
- [x] **Motore di sincronizzazione** (`src/lib/sync/`): invio in blocchi + download incrementale, vince la modifica più recente, ripresa dopo errori di rete, limite giornaliero, riallineamento dopo 180 giorni, protezione contro dati di un altro account. 8 test con un finto server (`engine.test.ts`). Stato nella pagina Account.
- [x] **Supabase sul PC** (Docker Desktop): `npm run db:local` lo avvia con le stesse migrazioni, `npm run dev:local-db` apre l'app collegata a lui, `npm run test:e2e` prova la sincronizzazione con account finti (5 prove: primo accesso, due telefoni, conflitti, separazione tra account, limite giornaliero). Provato anche dalle schermate: registrazione e allenamento arrivato da solo nel database.
- [ ] Estendere la sincronizzazione alle altre tabelle:
  - [x] peso, Mente, allenamenti (`src/lib/sync/tables.ts`);
  - [ ] pasti, profilo, check-in/diario, ciclo (consenso con `grant_cycle_consent`, cancellazione con `delete_cycle_data`);
  - [ ] indicatore discreto anche fuori dalla pagina Account (es. in Oggi), solo quando qualcosa non va;
  - invio in blocchi con "upsert", poi download di ciò che è cambiato (`server_updated_at`, con un minuto di sovrapposizione);
  - indicatore di stato discreto (sincronizzato / in coda / offline);
  - limite giornaliero raggiunto (codice `RL001`): i dati restano in coda, messaggio comprensibile, nuovo tentativo il giorno dopo;
  - telefono offline da più di 180 giorni: **prima** invia le modifiche locali, **poi** riscarica tutto; messaggio chiaro all'utente; test dedicato;
  - consenso al ciclo e cancellazione totale (`cycle-wiped-at`) si inviano con le funzioni del database, non come righe.
- [ ] **Primo accesso:** caricare i dati già sul telefono senza duplicarli né perderli (gli id sono già UUID), con test.
- [ ] Pulizia mensile delle righe cancellate da più di 180 giorni (pg_cron), anche sul telefono dopo l'invio.
- [x] Test dello schema in Vitest sulle migrazioni vere (`src/lib/storage/schema.test.ts`, PGlite).
- [ ] Blocco app facoltativo (PIN o biometria con WebAuthn) per diario e ciclo.
- [ ] Ricordarsi che il piano gratuito mette in pausa il progetto dopo 7 giorni senza attività.

## 1b. Schema v2 (sincronizzazione, ciclo solo per le donne, Salute)
Approvato e trasformato nelle migrazioni di `supabase/migrations/`, provate a ogni `npm test` su un Postgres in memoria (31 controlli).
- [x] Approvare la proposta.
- [x] `profiles` e `body_weights` riscritti nella core; il resto diviso in migrazioni nuove.

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
**Lancio: App Store di Apple, e se possibile Google Play in contemporanea** (deciso il 4/10/2026); web dopo. Stesso codice per entrambi (Capacitor).

**In pausa** finché non arriva il **D-U-N-S** (richiesto dall'utente il 4/10/2026): gli account Apple e Google saranno **come organizzazione** (su Google Play niente test obbligatorio con 12 tester). Nel frattempo si sistema l'app.

### Android (Google Play)
- [ ] App Android con Capacitor: si compila **su Windows** con Android Studio (gratuito), oppure con Codemagic insieme a iOS.
- [ ] Account **Google Play Console**: 25 $ una volta sola.
- [ ] ⚠️ **Account personali nuovi:** prima della pubblicazione serve un **test chiuso con almeno 12 tester per 14 giorni di fila**. Per lanciare insieme a iOS bisogna partire con il test chiuso almeno 2-3 settimane prima. (Gli account come organizzazione non hanno questo obbligo, ma serve il D-U-N-S.)
- [ ] Moduli obbligatori nella Play Console:
  - "Sicurezza dei dati" (quali dati si raccolgono e perché);
  - dichiarazione per le **app di salute** (il ciclo è un dato sensibile);
  - informativa privacy e **pagina web per chiedere la cancellazione dell'account** (Google vuole un URL, oltre al tasto nell'app);
  - classificazione dei contenuti.
- [ ] Livello di API Android richiesto da Google al momento dell'invio (target API aggiornato).
- [ ] Accesso: Google con il pulsante nativo (Credential Manager), Apple tramite pagina web (su Android non è obbligatorio), email.
- [ ] Abbonamenti con Google Play Billing (RevenueCat gestisce sia Apple sia Google).
- [ ] Notifiche: da Android 13 serve chiedere il permesso.
- [ ] Pacchetto AAB firmato con "Play App Signing".

### iOS (App Store)
Proposta in attesa di conferma:
- [ ] App iOS con **Capacitor** sopra il codice attuale (Next.js in export statico), senza riscrivere l'app.
- [ ] Export statico: lingua decisa nel browser (non più dal cookie letto sul server), CSP in un meta tag invece del proxy, niente redirect lato server.
- [ ] **Niente Mac:** si compila nel cloud con **Codemagic** (piano gratuito, Mac nel cloud), che manda l'app su TestFlight. Lo sviluppo continua su Windows nel browser.
- [ ] **Apple Developer Program** (99 $ l'anno): iscriversi qualche giorno prima della fase iOS (da privato bastano 1-2 giorni; come azienda serve il D-U-N-S e può volerci di più). Serve per TestFlight, per l'App Store e per configurare "Accedi con Apple".
- [ ] **Accesso al lancio: email + Apple + Google** (deciso il 4/10/2026). Nell'app iOS si usano i pulsanti nativi (Google blocca l'accesso dentro le WebView): il plugin restituisce un token e Supabase lo verifica con `signInWithIdToken`. Sul web si usa il normale reindirizzamento.
  - Google: client OAuth in Google Cloud Console (gratuito, si può fare subito).
  - Apple: Service ID e chiave dal Developer Program.
- [ ] Regole Apple prima dell'invio:
  - cancellazione dell'account dentro l'app;
  - Sign in with Apple obbligatorio se si offre l'accesso con Google;
  - abbonamenti solo con gli acquisti in-app di Apple (non Stripe), es. con RevenueCat;
  - informativa privacy e pagina di supporto raggiungibili da un URL pubblico;
  - "privacy label" in App Store Connect (dati raccolti) e classificazione per età;
  - l'app deve fare più di un sito web impacchettato (notifiche, vibrazione, funzioni offline aiutano).
- [ ] Email di conferma e recupero password con **codice a 6 cifre** invece del link (in un'app non serve gestire i link che riaprono l'app).
- [ ] TestFlight per provarla sul proprio iPhone prima dell'invio.
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
