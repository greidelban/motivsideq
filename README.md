# GetControl

Web app mobile-first (PWA), in inglese (lingua base) e italiano: allenamento mentale del mattino, diario personale, registro allenamenti, tracciamento alimentare e, opzionale, ciclo mestruale.
Stack: Next.js 16 (App Router) + TypeScript + Tailwind 4, zod, Vitest, Supabase (account facoltativo, nel browser).

> Il nome si cambia in `src/lib/app.ts`. Gli identificativi interni (chiavi di salvataggio, database locale, cookie) restano `ritmo`: cambiarli farebbe perdere i dati.

## Stato attuale

- **Prima di tutto sul dispositivo.** Senza account i dati restano solo qui:
  - i dati dell'utente (profilo, peso, Mente, allenamenti, pasti, ciclo) stanno in **IndexedDB**, già nel formato pronto per il cloud: ogni elemento ha id, date di creazione e modifica, cancellazione "morbida" e il segno "da inviare" (`src/lib/storage/local-db.ts`, elenco in `definitions.ts`);
  - le impostazioni del dispositivo (sfondo, animazioni, durata del calcolo) restano in `localStorage` (`local-store.ts`): servono subito e non vanno nel cloud;
  - al primo avvio i vecchi dati di `localStorage` passano a IndexedDB; si cancellano solo dopo aver verificato la copia (`migration.ts`); se IndexedDB non si apre, l'app continua come prima con `localStorage`.
- **Offline:** il service worker (`public/sw.js`) prepara le schermate principali e i file dell'app; senza rete l'app si apre e i dati si registrano sul dispositivo (si sincronizzano al ritorno della rete).
- **Copia di sicurezza:** Impostazioni → "Esporta i miei dati" (file JSON) e "Importa da un file" (unisce senza perdere nulla).
- **Account facoltativo** (Impostazioni → Account, pagina `/account`): accesso, registrazione con conferma via email e recupero password, nel browser con Supabase (progetto in UE). Con l'abbonamento tutti i dati si sincronizzano tra dispositivi, **cifrati end-to-end**: la chiave nasce sul telefono e il server vede solo testo illeggibile (`src/lib/crypto/`, `src/lib/sync/`). Su un nuovo dispositivo serve il codice di recupero. All'uscita si può scegliere di togliere dati e chiave dal dispositivo. Le attività rimandate sono in **[DA_FARE.md](DA_FARE.md)**.
- **Mente** è completo:
  - routine "Risveglio" (4 esercizi, circa 4 minuti);
  - esercizi singoli: Reazione, Colori (Stroop), Calcolo rapido (Zetamac) e Tabella di Schulte;
  - per ogni esercizio: storico, record e confronto con il proprio solito.
- **Luce viva:** lo sfondo animato, generato in tempo reale (WebGL, senza librerie) e ispirato ai video di illusioni ottiche di klsr. Si sceglie in Impostazioni → **Wallpaper** (pagina `/settings/wallpaper`), con 10 colori per ogni sfondo:
  - **Fumo:** fumo caldo (pesca, rosa, magenta), raggi di luce e la croce al centro;
  - **Galassia:** realistica e inclinata, con polvere scura, stelle di colori e luminosità diverse; ruota piano e respira;
  - **Cristallo:** luce che attraversa il ghiaccio, con aghi, brina, scintillii iridescenti e fasci verticali;
  - **Scintille:** grappoli di luci sfocate (bokeh) e polvere che brilla, con un bagliore lento ogni tanto;
  - **Prisma:** piani di luce dai bordi netti, con frange colorate, che ruotano attorno a un vertice;
  - **Classico:** lo sfondo fermo in CSS.
  - Respira da solo e gira attorno al dito con un tocco sullo sfondo libero (i tocchi su pulsanti, menu e pannelli non lo muovono). Scorrere e trascinare non lo deformano, e la barra del browser che compare e sparisce non lo stira (canvas alto `100lvh`).
  - Ogni schermata ne regola l'intensità, i giochi mandano impulsi di luce, e durante il Risveglio cresce come un'alba.
  - Con "riduci movimento" diventa un'immagine ferma; senza WebGL resta lo sfondo CSS.
- **Animazioni** (cursore in Impostazioni, da "Ferme" a "Massime"): regola velocità e ampiezza degli sfondi e delle animazioni dell'interfaccia. "Riduci movimento" del sistema vince sempre.
- **Cambio scheda immediato:** le pagine del menu vengono precaricate e restano in cache per 5 minuti (`experimental.staleTimes`); la lente del menu si sposta subito al tocco; nessuna animazione di comparsa a ogni cambio pagina.
- **Accendi** (`/mind/light`, primo passo del Risveglio): 30 secondi in cui fissi il centro e respiri con la luce (4 s dentro, 6 fuori).
  - La luce si accende quando inspiri e si abbassa quando espiri, e intanto cresce come un'alba fino al bagliore finale.
  - Funziona anche con lo sfondo Classico: durante l'esercizio la luce si accende comunque.
- Nel calcolo rapido si vedono il tempo di ogni risposta, la media, la risposta più veloce e più lenta, e il tempo medio per operazione.
- **Lingue:** inglese come base, italiano tradotto. Si riconosce la lingua del browser e si cambia in Impostazioni (cookie `ritmo-locale`).
- **Salute** (Allenamento, Cibo, Ciclo) ha una prima versione locale. Il Ciclo compare solo a chi indica sesso femmina (`canUseCycle` in `src/lib/health/cycle-access.ts`); il peso si può vedere in kg o lb, ma si salva in kg.
- **Database:** lo schema per Supabase è in `supabase/migrations/`, provato a ogni `npm test` su un Postgres in memoria (RLS, abbonamento, limiti, nessuna colonna in chiaro). Riassunto in [docs/SCHEMA.md](docs/SCHEMA.md). `npm run db:bundle` unisce le migrazioni in un file da incollare nello SQL Editor.

## Configurare Supabase

1. Copia `.env.example` in `.env.local` e compila URL, chiave **publishable** e indirizzo dell'app. Senza questi valori l'account non compare e l'app resta solo sul dispositivo.
2. Esegui le migrazioni: `npm run db:bundle` (tutte) oppure `npm run db:bundle -- <nome>` (da quella in poi), poi incolla `supabase/setup-completo.sql` nello SQL Editor.
3. Impostazioni di Supabase da controllare (URL, template delle email, password): vedi DA_FARE.md, sezione 1.

Per provare senza toccare il progetto online c'è Supabase sul PC (serve Docker Desktop): `npm run db:local`, poi `npm run dev:local-db` (app collegata a lui) e `npm run test:e2e` (sincronizzazione cifrata con account finti; per provare il cloud dall'app, il piano dell'account va messo a `pro` nel database del PC).

## Aggiungere una lingua

1. Copia `src/i18n/dictionaries/en.ts` in `<codice>.ts`, per esempio `es.ts`, e traduci i valori. Le chiavi e i segnaposto `{x}` restano uguali.
2. Registrala in `src/i18n/dictionaries/index.ts` e in `LOCALES` / `LOCALE_NAMES` di `src/i18n/config.ts`.
3. Aggiungi i testi della pagina offline in `public/sw.js` (`OFFLINE_TEXT`).
4. Esegui `npm test`: segnala chiavi mancanti, testi vuoti e segnaposto diversi.

## Comandi

| Comando | Cosa fa |
|---|---|
| `npm run dev` | avvia l'app su http://localhost:3000 |
| `npm test` | test unitari (Vitest) della logica di calcolo |
| `npm run typecheck` | controllo dei tipi TypeScript |
| `npm run lint` | ESLint |
| `npm run build` | build di produzione |
| `npm run icons` | rigenera le icone PNG della PWA |
| `npm run db:bundle` | unisce le migrazioni in `supabase/setup-completo.sql` da incollare nello SQL Editor di Supabase |
| `npm run db:local` | avvia Supabase sul PC (Docker) con le stesse migrazioni |
| `npm run dev:local-db` | avvia l'app collegata al Supabase sul PC |
| `npm run test:e2e` | prova la sincronizzazione contro il Supabase sul PC |

Per provarla sul telefono, nella stessa rete Wi-Fi:

```bash
npm run dev -- --hostname 0.0.0.0
```

Poi apri `http://<IP-del-PC>:3000`. Per installarla come PWA serve HTTPS, quindi una versione pubblicata (vedi DA_FARE.md).

## Struttura

```
src/app/(app)/          pagine con la barra in basso (/today, /mind, /journal, /health/*, /chat, /settings)
src/app/(focus)/        schermate a tutto schermo (i giochi di Mente)
src/i18n/               lingue: configurazione, dizionari, formattazione di numeri e durate
src/lib/                logica pura, con test *.test.ts accanto
src/lib/brain/          giochi mentali: generatori, punteggi, storico, routine
src/lib/light/          luce viva: inviluppo (puro, testato) e bus condiviso (intensità, impulsi, respiro)
src/components/light/   renderer WebGL, shader, esercizio "Accendi"
src/lib/storage/        archivio locale (IndexedDB + localStorage), migrazione, export/import
src/components/         componenti UI (stile "Liquid Atlas": vetro, bordi luminosi, card piatte)
src/proxy.ts            Content-Security-Policy con nonce per richiesta
supabase/migrations/    schema del database (Supabase), provato da src/lib/storage/schema.test.ts
docs/SCHEMA.md          documentazione del database
src/lib/supabase/       client Supabase nel browser e configurazione
src/lib/crypto/         cifratura end-to-end: chiave dati, codice di recupero, chiave sul dispositivo
src/lib/sync/           sincronizzazione telefono ↔ cloud cifrato (motore puro e testato, avvio, uscita con "togli i dati")
```

## Principi

- **La logica di calcolo è pura e testata** (`src/lib/**`): i componenti si occupano solo di interazione e grafica.
- **I tempi di reazione si misurano bene:**
  - eventi `pointerdown`, non `click`;
  - la partenza viene allineata al frame in cui lo stimolo appare (`useAlignToPaint`);
  - sotto i 100 ms il tocco è un anticipo, non una reazione.
- **Confronti gentili:** si confronta un risultato solo con le proprie prove fatte con le stesse impostazioni, e solo dopo almeno 3 prove. Niente classifiche e niente messaggi colpevolizzanti.
- **Sicurezza:**
  - la CSP usa un nonce per richiesta;
  - gli header di sicurezza sono in `next.config.ts`;
  - i dati salvati sono validati alla lettura;
  - i dati vanno nel cloud solo cifrati sul dispositivo: il gestore non può leggerli;
  - la RLS del database decide chi vede cosa: l'app usa solo la chiave pubblica;
  - nessun servizio di terze parti oltre a Supabase (e solo con l'account).
