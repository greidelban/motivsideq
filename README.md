# Ritmo

Web app mobile-first (PWA), in inglese (lingua base) e italiano: allenamento mentale del mattino, diario personale, registro allenamenti, tracciamento alimentare e, opzionale, ciclo mestruale.
Stack: Next.js 16 (App Router) + TypeScript + Tailwind 4, zod, Recharts, Vitest. Supabase è previsto più avanti.

> "Ritmo" è un nome provvisorio: si cambia in `src/lib/app.ts`.

## Stato attuale

- **Nessun account.** I dati restano sul dispositivo, nel `localStorage` del browser, tramite gli store di `src/lib/storage/local-store.ts`.
- Il login con Supabase era pronto ed è in `archivio/login/`: tornerà con il backend. Le attività rimandate sono in **[DA_FARE.md](DA_FARE.md)**.
- **Mente** è completo:
  - routine "Risveglio" (4 esercizi, circa 4 minuti);
  - esercizi singoli: Reazione, Colori (Stroop), Calcolo rapido (Zetamac) e Tabella di Schulte;
  - per ogni esercizio: storico, record e confronto con il proprio solito.
- **Luce viva:** lo sfondo animato, generato in tempo reale (WebGL, senza librerie) e ispirato ai video di illusioni ottiche di klsr. Si sceglie in Impostazioni:
  - **Fumo:** fumo caldo (pesca, rosa, magenta), raggi di luce e la croce al centro;
  - **Galassia:** realistica e inclinata, con polvere scura, stelle di colori e luminosità diverse; ruota piano e respira;
  - **Cristallo:** luce che attraversa il ghiaccio, con aghi, brina, scintillii iridescenti e fasci verticali;
  - **Scintille:** grappoli di luci sfocate (bokeh) e polvere che brilla, con un bagliore lento ogni tanto;
  - **Prisma:** piani di luce dai bordi netti, con frange colorate, che ruotano attorno a un vertice;
  - **Classico:** lo sfondo fermo in CSS.
  - Respira da solo e gira attorno al dito con un tocco. Scorrere e trascinare non lo deformano, e la barra del browser che compare e sparisce non lo stira (canvas alto `100lvh`).
  - Ogni schermata ne regola l'intensità, i giochi mandano impulsi di luce, e durante il Risveglio cresce come un'alba.
  - Con "riduci movimento" diventa un'immagine ferma; senza WebGL resta lo sfondo CSS.
- **Animazioni** (cursore in Impostazioni, da "Ferme" a "Massime"): regola velocità e ampiezza degli sfondi e delle animazioni dell'interfaccia. "Riduci movimento" del sistema vince sempre.
- **Cambio scheda immediato:** le pagine del menu vengono precaricate e restano in cache per 5 minuti (`experimental.staleTimes`); la lente del menu si sposta subito al tocco; nessuna animazione di comparsa a ogni cambio pagina.
- **Accendi** (`/mind/light`, primo passo del Risveglio): 30 secondi in cui fissi il centro e respiri con la luce (4 s dentro, 6 fuori).
  - La luce si accende quando inspiri e si abbassa quando espiri, e intanto cresce come un'alba fino al bagliore finale.
  - Funziona anche con lo sfondo Classico: durante l'esercizio la luce si accende comunque.
- Nel calcolo rapido si vedono il tempo di ogni risposta, la media, la risposta più veloce e più lenta, e il tempo medio per operazione.
- **Lingue:** inglese come base, italiano tradotto. Si riconosce la lingua del browser e si cambia in Impostazioni (cookie `ritmo-locale`).
- Diario, Palestra e Cibo sono i prossimi moduli.

## Aggiungere una lingua

1. Copia `src/i18n/dictionaries/en.ts` in `<codice>.ts`, per esempio `es.ts`, e traduci i valori. Le chiavi e i segnaposto `{x}` restano uguali.
2. Registrala in `src/i18n/dictionaries/index.ts` e in `LOCALES` / `LOCALE_NAMES` di `src/i18n/config.ts`.
3. Aggiungi i testi della pagina offline in `public/sw.js`.
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

Per provarla sul telefono, nella stessa rete Wi-Fi:

```bash
npm run dev -- --hostname 0.0.0.0
```

Poi apri `http://<IP-del-PC>:3000`. Per installarla come PWA serve HTTPS, quindi una versione pubblicata (vedi DA_FARE.md).

## Struttura

```
src/app/(app)/          pagine con la barra in basso (/today, /mind, /journal, /gym, /food, /settings)
src/app/(focus)/        schermate a tutto schermo (i giochi di Mente)
src/i18n/               lingue: configurazione, dizionari, formattazione di numeri e durate
src/lib/                logica pura, con test *.test.ts accanto
src/lib/brain/          giochi mentali: generatori, punteggi, storico, routine
src/lib/light/          luce viva: inviluppo (puro, testato) e bus condiviso (intensità, impulsi, respiro)
src/components/light/   renderer WebGL, shader, esercizio "Accendi"
src/lib/storage/        salvataggio locale validato con zod
src/components/         componenti UI (stile "Liquid Atlas": vetro, bordi luminosi, card piatte)
src/proxy.ts            Content-Security-Policy con nonce per richiesta
supabase/migrations/    schema SQL per il futuro backend (non ancora usato)
docs/SCHEMA.md          documentazione del database futuro
archivio/login/         codice del login, messo da parte
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
  - nessun servizio di terze parti.
