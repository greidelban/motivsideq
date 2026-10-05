# Da fare

Fase 2 (piano approvato): A1 dati pronti al cloud ✅ → E ciclo solo per le donne ✅ → **A2 Supabase** → check-in giornaliero → B ciclo → D allenamento → C alimentazione.

## 0. Revisione dell'app (4/10/2026, un punto alla volta)
- [x] 1. Sicurezza: database, account, sincronizzazione, intestazioni; poi cifratura end-to-end (sezione 1).
- [x] 2. Pulizia: tolti `archivio/login` e `recharts`, codice morto, documentazione e informativa allineate.
- [x] 3. Interfaccia in formato telefono (375 e 320 px, inglese e italiano) e accessibilità:
  - vetro che scurisce lo sfondo invece di schiarirlo; schede con testo sempre su vetro elevato; etichette sopra lo sfondo con velo scuro: contrasto ≥ 4.5 misurato anche al centro del fascio di luce;
  - aree di tocco di almeno 44 px (chip, linguette, frecce, link-pulsante);
  - freccetta sulle schede toccabili di Oggi; barra dello spazio locale visibile;
  - controllati: niente pagine più larghe dello schermo, nomi accessibili, etichette dei campi, titoli, id unici.
  - [x] Ciclo controllato con un profilo di prova (consenso, stato, calendario, sintomi).
  - [ ] Da rivedere quando ci sono: Diario (oggi segnaposto), schermate durante il gioco e dei risultati con dati veri.
- [x] 4. Velocità, stabilità, offline:
  - JavaScript di Oggi da 1.197 a 616 kB: zod nella versione leggera (da 391 a 72 kB), Supabase caricato solo con un account (−243 kB per chi non lo usa);
  - pagine di errore e 404 nello stile dell'app; avviso quando il dispositivo non riesce a salvare;
  - offline: schermate principali pronte anche senza rete (provato spegnendo il server: Allenamento, Mente, salvataggio di un allenamento);
  - cancellare i dati del ciclo ora arriva anche al cloud e agli altri dispositivi (prima restavano nel cloud cifrato); i segnali di cancellazione spariscono dal telefono dopo l'invio.

## 1. Account e backend (Supabase): fase A2
Progetto Supabase `idghdzlznxhqlpaqdmfy` (Central EU, Frankfurt). Chiavi in `.env.local` (escluso da git): l'app usa la chiave **publishable**.
Il login si fa nel browser con `@supabase/supabase-js` (`src/lib/supabase/client.ts`, pagine `/account` e `/auth/confirm`).
- [x] Progetto Supabase gratuito creato (regione **Central EU (Frankfurt)**).
- [x] URL e chiavi in `.env.local` (modello: `.env.example`).
- [x] **Sicurezza:** la chiave `service_role` incollata in chat il 4/10/2026 è stata resa inutilizzabile il 5/10/2026 (*Legacy API keys → Disable*, da non riattivare) e tolta da `.env.local`. L'app usa la chiave publishable. Quando servirà una chiave segreta (es. cancellazione account) si crea una *secret key* nuova (`sb_secret_…`), mai in chat né su git.
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
- [x] Migrazioni 0006–0008 eseguite online il 4/10/2026 (verificato dall'esterno: `row_totals` esiste).
- [x] **Eseguita online (4/10/2026) la migrazione `20261005090000_e2e_vault.sql`** (cifratura end-to-end): `npm run db:bundle -- 20261005090000`, poi incollare `supabase/setup-completo.sql` nello SQL Editor. Toglie le tabelle in chiaro (c'erano solo dati di prova). **Prima di usare il cloud online.**
- [ ] Per provare il cloud con il proprio account prima degli acquisti in-app: nello SQL Editor `update public.profiles set plan = 'pro' where id = '<il tuo id>';` (l'id è in *Authentication → Users*).
- [x] **Cifratura end-to-end** (decisa il 4/10/2026: il gestore non deve poter leggere nulla): chiave dati sul dispositivo, codice di recupero, una sola tabella cifrata `vault_records` (`src/lib/crypto/`, `docs/SCHEMA.md`). Provata con test (cifratura, motore, schema, 6 prove sul Supabase del PC) e dalle schermate: attivazione, codice, nuovo dispositivo, codice sbagliato, nuovo codice.
- [x] **Motore di sincronizzazione** (`src/lib/sync/`): tutti gli elenchi con `sync: true`, cifrati; invio in blocchi + download incrementale, vince la modifica più recente, ripresa dopo errori di rete, limite giornaliero, riallineamento dopo 180 giorni, protezione contro dati di un altro account o di un'altra chiave. Il primo collegamento di un dispositivo carica tutto ciò che c'è già (senza doppioni).
- [x] **Supabase sul PC** (Docker Desktop): `npm run db:local`, `npm run dev:local-db`, `npm run test:e2e`.
- [ ] Indicatore discreto dello stato del cloud anche fuori dalla pagina Account (es. in Oggi), solo quando qualcosa non va (codice da inserire, spazio pieno, abbonamento scaduto).
- [ ] **Abbonamento:** acquisti in-app (App Store / Google Play) che aggiornano `profiles.plan` dal server; finché non ci sono, il cloud si prova solo mettendo `pro` a mano.
- [ ] Nell'app per iPhone: chiave del dispositivo nel Portachiavi (sincronizzato con iCloud: un nuovo iPhone non chiede il codice).
- [ ] Pulizia mensile delle righe cancellate da più di 180 giorni (pg_cron), anche sul telefono dopo l'invio. **Prima del lancio:** l'informativa promette che le righe cancellate spariscono del tutto. Abbassare anche `row_totals`.
- [x] Test dello schema in Vitest sulle migrazioni vere (`src/lib/storage/schema.test.ts`, PGlite), compreso il divieto di colonne con dati in chiaro.
- [ ] Blocco app facoltativo (PIN o biometria con WebAuthn) per diario e ciclo.
- [ ] Ricordarsi che il piano gratuito di Supabase mette in pausa il progetto dopo 7 giorni senza attività.
- [x] Revisione di sicurezza del 4/10/2026:
  - [x] id per utente (migrazione 0007) e codice tolto dall'indirizzo di /auth/confirm;
  - [x] "Esci e togli i dati da questo dispositivo" (pagina Account): prima un ultimo invio, poi avvisa se qualcosa esiste solo sul telefono; toglie anche la chiave;
  - [x] tetti di righe e di spazio per utente (errore `RL002`, messaggio nella pagina Account);
  - [ ] per lo scanner dei codici a barre sul web servirà togliere `camera=()` da `Permissions-Policy` (`next.config.ts`).
- [x] Spazio locale: indicatore nelle Impostazioni (tetto 1 GB, `src/lib/storage/quota.ts`). Da far rispettare quando arriveranno le foto.

## 1b. Schema
Riassunto in `docs/SCHEMA.md`. Lo schema v2 con tabelle in chiaro (peso, profilo, ciclo, diario…) è stato sostituito il 4/10/2026 dal caveau cifrato; le sue regole su età e Ciclo ora valgono solo nell'app.

## 2. Privacy e aspetti legali
- [ ] Compilare titolare e contatto in `src/app/privacy/page.tsx` (ora sono segnaposto `[...]`).
- [x] Informativa aggiornata con account, abbonamento e cifratura end-to-end (4/10/2026). Da aggiornare a ogni dato che il gestore può vedere.
- [ ] Far rivedere informativa, disclaimer e consenso per i dati del ciclo (art. 9 GDPR) da un consulente privacy prima del lancio pubblico.
- [ ] Verificare le regole per i minori di 14-17 anni (consenso digitale in Italia: 14 anni).

## 3. Account: funzioni da completare
- [x] Export e import JSON in locale (Impostazioni → Copia di sicurezza).
- [ ] Export anche in CSV (dall'app: il server non può leggere i dati).
- [ ] Cancellazione account dall'app (obbligatoria per l'App Store): funzione sul server con la chiave secret, tutto sparisce a cascata.
- [ ] Rate limit sulla creazione di alimenti e voti (già previsto via trigger nello schema).
- [x] Test automatici delle regole RLS (un utente non vede né tocca i dati di un altro): `schema.test.ts` e `sync.e2e.ts`.

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
