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
  - [x] Diario controllato (375 e 320 px, inglese ed ebraico).
  - [ ] Da rivedere quando ci sono: schermate durante il gioco e dei risultati con dati veri.
- [x] 4. Velocità, stabilità, offline:
  - JavaScript di Oggi da 1.197 a 616 kB: zod nella versione leggera (da 391 a 72 kB), Supabase caricato solo con un account (−243 kB per chi non lo usa);
  - pagine di errore e 404 nello stile dell'app; avviso quando il dispositivo non riesce a salvare;
  - offline: schermate principali pronte anche senza rete (provato spegnendo il server: Allenamento, Mente, salvataggio di un allenamento);
  - cancellare i dati del ciclo ora arriva anche al cloud e agli altri dispositivi (prima restavano nel cloud cifrato); i segnali di cancellazione spariscono dal telefono dopo l'invio.

## 0b. Frasi del giorno (5/10/2026)
- [x] Archivio di 291 frasi in 11 lingue, 4 categorie, toni Soft / Diretto / Duro; temi vietati controllati dai test in ogni lingua. Il 5/10/2026 aggiunte 135 frasi del proprietario (da mv.txt), corrette, tradotte e suddivise; escluse solo quella sull'aspetto fisico ("ugly people") e quella sull'autunno (stagionale). Tono di partenza "Diretto" (personalità più aggressiva).
- [ ] Facoltativo: frasi legate alla stagione (es. "You smell that? It's autumn") con un campo "mesi" nell'archivio.
- [x] "Frase del giorno" in Oggi; impostazioni in `/settings/quotes` (tono, orari, ore di silenzio, pausa).
- [x] Pianificazione delle notifiche locali (limite di iOS, ore di silenzio, pausa, nessun dato personale) e invio al plugin nativo. Provato nel browser con un plugin finto (27 notifiche programmate, una sponsorizzata nel suo canale, toccate solo le notifiche delle frasi).
- [x] Frasi sponsorizzate: file firmato, max 10 slot da un giorno, consenso separato e non preselezionato, limiti 1/settimana e 1/mese per sponsor, carta solo in Oggi. Provato nel browser con un file di prova (download, carta, file manomesso rifiutato, disattivazione che toglie il file).
- [ ] Quando arriva Capacitor: installare `@capacitor/local-notifications` (il codice lo trova da solo in `window.Capacitor`), provare le notifiche vere su iPhone e Android, icona piccola delle notifiche su Android.
- [ ] Android 13+: il permesso si chiede già quando si accendono le notifiche; da Android 12 valutare `SCHEDULE_EXACT_ALARM` se gli orari arrivano in ritardo.
- [ ] Sponsor: creare le chiavi vere (`node scripts/sponsor-keys.mjs`), scegliere dove pubblicare il file (es. lo stesso hosting dell'app) e impostare `NEXT_PUBLIC_SPONSOR_FEED_URL` e `NEXT_PUBLIC_SPONSOR_PUBLIC_KEY`. **Custodire la chiave privata** (chi la ha può far comparire frasi nell'app).
- [ ] Prima di vendere slot: contratto/regole per gli sponsor (temi vietati, niente link, una frase al giorno), e verifica legale dell'etichetta "Sponsorizzato" e del consenso (App Store, regola 4.5.4: notifiche promozionali solo con consenso esplicito nell'app e un modo per disattivarle, come qui).
- [ ] Far rivedere da madrelingua le frasi in tutte le lingue (le traduzioni sono mie), soprattutto quelle ironiche ("Gne gne", "Womp womp") che si adattano più che tradursi.
- [ ] Facoltativo: l'utente sceglie le categorie che preferisce (oggi tutte e quattro).

## 0d. Diario e check-in giornaliero (5/10/2026)
- [x] Check-in di qualsiasi giorno passato: umore, energia, fame (5 livelli con un disegno, la parola accanto al titolo) e ore di sonno. Unica fonte di questi valori.
- [x] Pagina del giorno con spunto (12 spunti in 11 lingue, uno al giorno, "un altro spunto"), salvataggio automatico, cancellazione della singola pagina.
- [x] Settimana da scorrere con l'umore di ogni giorno, "torna a oggi"; riepilogo degli ultimi 7 giorni (umore, energia, sonno, giorni registrati); ricerca nelle pagine; "cancella tutto il diario".
- [x] Scheda "Come stai oggi?" in Oggi (umore con un tocco); il Ciclo mostra il check-in del giorno.
- [x] Nel cloud cifrato e nella copia di sicurezza (`check-ins`, `journal-pages`); informativa aggiornata in 11 lingue.
- [ ] Far rivedere da madrelingua spunti e livelli (traduzioni mie; in polacco, russo ed ebraico le domande sono impersonali o in prima persona per restare neutre).
- [ ] Promemoria facoltativo serale "Com'è andata oggi?" (notifica locale, come le frasi; id da riservare).
- [ ] Blocco con PIN o biometria per Diario e Ciclo (sezione 1).
- [ ] Insight: legare umore, energia e sonno ad allenamenti, cibo e ciclo (modulo "insight").
- [ ] Facoltativo: aprire dal Ciclo il Diario sul giorno scelto (oggi apre su oggi).

## 0e. Alimentazione: tabella degli alimenti (5/10/2026)
Deciso con l'utente: prima una tabella dentro l'app, poi correzioni dagli utenti "stile Wikipedia".
- [x] 113 alimenti generici (cereali, carne e pesce, latticini, legumi, verdura, frutta, frutta secca, condimenti, dolci, bevande) con kcal, proteine, carboidrati e grassi per 100 g/ml e porzioni tipiche; nomi e sinonimi in 11 lingue.
- [x] Ricerca (senza accenti né maiuscole, sinonimi: "frollini" trova i biscotti), scelta della porzione o dei grammi, valori calcolati, aggiunta al pasto. L'inserimento a mano resta ("Inserisci a mano").
- [x] Le voci ricordano alimento e quantità: il nome segue la lingua dell'app; "Aggiungi di nuovo" ricopia anche la quantità.
- [x] Bevande alcoliche nascoste ai minorenni.
- [ ] **Prima del lancio: ricontrollare i valori uno per uno** su una fonte pubblica citabile (USDA FoodData Central, pubblico dominio; oppure CIQUAL, licenza aperta) e indicarla nell'app. Li ho scritti come medie di riferimento: dal PC non si raggiunge il sito USDA per confrontarli in automatico.
- [ ] Far rivedere i nomi degli alimenti da madrelingua (soprattutto arabo, ebraico, cinese, polacco).
- [ ] Ampliare la tabella (piatti tipici per paese, prodotti da forno, bevande vegetali, salse) man mano.
- [x] Correzioni "stile Wikipedia" (deciso con l'utente: solo account verificati, media di tutti): "Valori sbagliati? Correggili" sotto l'alimento scelto; energia in kcal o kJ, proteine, carboidrati, grassi per 100 g/ml; stesse regole di coerenza dell'app anche nel database; un voto per persona (si può rimandare per cambiarlo); da 5 voti l'app mostra e usa la mediana ("Corretto dalla comunità"); 30 correzioni al giorno al massimo; informativa aggiornata in 11 lingue. Provato con i test del database (PGlite) e nel browser (modulo, kcal↔kJ, richiesta di account).
- [ ] **Eseguire online la migrazione `20261006090000_food_corrections.sql`**: `npm run db:bundle -- 20261006090000`, poi incollare `supabase/setup-completo.sql` nello SQL Editor.
- [ ] Provare l'invio vero con un account verificato (sul Supabase del PC con `npm run dev:local-db`, poi online).
- [ ] La futura cancellazione dell'account deve chiamare prima `withdraw_food_corrections()` (le correzioni non sono legate all'account con una chiave esterna).
- [ ] Moderazione: oggi basta la mediana; se servisse, una lista di alimenti bloccati o un minimo di voti più alto.
- [ ] Aggiunta di alimenti nuovi dagli utenti (oggi si correggono solo quelli della tabella).
- [ ] Facoltativo: preferiti, ricette (somma di più alimenti), acqua.

## 0f. Allenamento usabile (6/10/2026)
- [x] Esercizi con serie, ripetizioni (o secondi per il plank) e peso, per Palestra, Calisthenics e Funzionale: ricerca tra 39 esercizi in 11 lingue (con il gruppo muscolare) o nome libero; una serie nuova copia la precedente.
- [x] "L'ultima volta" per ogni esercizio e "Come l'ultima volta" in un tocco; esercizi recenti come scorciatoie.
- [x] Record personali al salvataggio (massimale stimato, peso, ripetizioni a corpo libero, secondi) con un bagliore; "I tuoi esercizi" con ultima volta e record.
- [x] Timer di recupero (60/90/120/180 s), giusto anche se il telefono mette in pausa la pagina; vibrazione alla fine.
- [x] Distanza per corsa, camminata, escursione, nuoto, vogatore (passo al km) e bici (km/h).
- [x] L'allenamento in corso resta anche chiudendo l'app (bozza sul telefono), "Scarta questo allenamento".
- [x] Storico con esercizi, serie, volume e distanza. Provato nel browser (italiano 375 px, ebraico 320 px).
- [ ] Notifica locale alla fine del recupero quando l'app è in secondo piano (con Capacitor).
- [ ] Modificare un allenamento già salvato (oggi si cancella e si rifà).
- [ ] Schede/routine salvate ("Giorno A: petto e tricipiti") da ripetere.
- [ ] Grafico dei progressi per esercizio; distanza anche in miglia per chi usa le libbre.
- [ ] Far rivedere i nomi degli esercizi da madrelingua.

## 0g. Andamento (insight), prima versione (6/10/2026)
- [x] Schermata "Andamento" (da Oggi): riepilogo del periodo; sonno → umore ed energia; allenamento → umore ed energia; sonno → riflessi (gioco Reazione); Ciclo → umore ed energia (solo con il Ciclo attivo); giorno migliore della settimana. 30 o 90 giorni. Tutto calcolato sul telefono.
- [x] Provato con Giorgio e Marta (45 giorni di storico verosimile) in italiano 375 px e arabo 320 px.
- [ ] Insight sul cibo (proteine e allenamento, regolarità dei pasti) e sul peso: da decidere con l'utente (temi delicati; mai per i minorenni).
- [ ] Sintomi del ciclo e umore; sonno e allenamento del giorno dopo.
- [ ] Far rivedere i testi da madrelingua.

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

## 0c. Ciclo: uso quotidiano (5/10/2026)
- [x] Calendario del mese: mestruazioni registrate, previste (tratteggiate), finestra fertile, ovulazione, oggi, giorni con note; mesi avanti e indietro; da destra a sinistra in arabo ed ebraico.
- [x] Tocco su un giorno: segnarlo o toglierlo come giorno di mestruazioni (si allunga, accorcia, unisce o crea da solo), flusso e sintomi anche dei giorni passati. Il vecchio modulo con la data è sparito.
- [x] Pulsante rapido "iniziate oggi" / "finite oggi"; toccando una mestruazione nello storico la si apre nel calendario.
- [x] Scheda del ciclo in Oggi (giorno, fase, prossime mestruazioni), nascondibile per chi teme sguardi sullo schermo.
- [x] Promemoria 1-3 giorni prima delle mestruazioni previste (notifica locale alle 9), discreti di default. Provato nel browser con un plugin finto: due promemoria, canale privato, notifiche delle frasi intatte.
- [x] Il giorno scelto nel calendario del ciclo mostra il check-in del Diario (sola lettura: la fonte resta il check-in).
- [ ] Rapporti, protezione e pillola (decisi: solo sul telefono, consenso a parte, non sincronizzati).
- [ ] Orario dei promemoria scelto dall'utente (oggi fisso alle 9) e promemoria "segna il ciclo" se è in ritardo.
- [ ] Prova su telefono vero dei promemoria (iPhone e Android: canale privato sullo schermo bloccato).

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
- [ ] Promemoria facoltativo "È ora del risveglio" la mattina: notifica **locale** come le Frasi del giorno (restano 14 posti liberi sotto il limite di iOS, `RESERVED_FOR_OTHER_NOTIFICATIONS`).
- [ ] Prova reale su iPhone e Android installando la PWA: vibrazione al tocco, tastierino, aree sicure.
- [ ] Luce viva su telefoni veri: fluidità e consumo di batteria (eventualmente un livello "leggero" automatico sui dispositivi lenti, come in pathwyr).
- [ ] Interruttore in Impostazioni per spegnere la luce viva (oggi si adatta solo a "riduci movimento").

## 6. Lingue
11 lingue dal 5/10/2026: inglese, italiano, spagnolo, francese, portoghese (Brasile), tedesco, polacco, russo, cinese semplificato, arabo ed ebraico (da destra a sinistra). Interfaccia, frasi, parole vietate e pagina offline. Provato nel browser in arabo, ebraico, cinese e russo.
- [ ] Far rivedere da madrelingua tutte le lingue, soprattutto disclaimer, informativa e testi del ciclo (oggi sono traduzioni mie).
- [ ] Arabo: oggi maschile generico (i verbi rivolti a "tu" hanno sempre un genere); le schermate del Ciclo usano il femminile. Valutare con un madrelingua.
- [ ] Arabo: le cifre seguono `Intl` (oggi latine); i giochi mostrano sempre cifre latine e operazioni da sinistra a destra.
- [ ] Portoghese: oggi variante del Brasile; se serve anche il Portogallo, aggiungere `pt-PT`.
- [ ] Cinese: oggi solo semplificato (anche Taiwan e Hong Kong lo ricevono); valutare il tradizionale (`zh-Hant`).
- [ ] Ebraico: pulsanti e frasi all'infinito (neutro), altrove maschile generico; il Ciclo al femminile. Da far rivedere.
- [ ] Prova su telefoni veri in arabo ed ebraico (da destra a sinistra) e cinese (caratteri di sistema).
- [ ] Altre lingue possibili con lo stesso schema (giapponese, coreano, turco, olandese…): vedi README, "Aggiungere una lingua".
- [ ] Per ogni nuova lingua: disclaimer e informativa vanno rivisti anche dal punto di vista legale del paese.
- [ ] Manifest PWA per lingua (oggi nome e descrizione sono solo in inglese).

## 7. Più avanti (solo predisposti)
- [ ] Chat in incognito (`/chat`, tasto accanto alle Impostazioni): oggi c'è solo la schermata, col lucchetto. Si sblocca con l'abbonamento: in `src/lib/entitlements.ts` è `chat: ["pro"]`, quindi il lucchetto sparisce da solo per chi ha il piano pro (per aprirla a tutti basta aggiungere `"free"`). Serve decidere il motore (le regole del progetto vietano AI/LLM finché non si cambia idea); i messaggi devono restare solo in memoria, mai salvati.
- [ ] Abbonamento con Stripe: tabella `subscriptions`, webhook che aggiorna `profiles.plan`, `can()` in `src/lib/entitlements.ts`.
- [ ] AI lato server: tabella `ai_usage`, controllo del piano, consenso separato per diario e ciclo.
