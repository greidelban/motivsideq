@AGENTS.md

# Progetto Ritmo: note per chi ci lavora

- **Lingue:** l'inglese è la lingua base, l'italiano la prima traduzione, altre lingue arriveranno.
  - Nessun testo visibile scritto nei componenti: tutto passa da `src/i18n/dictionaries/*.ts` (`useI18n()` nei client, `getI18n()` nei server component).
  - Le chiavi si aggiungono prima in `en.ts`; TypeScript e i test (`src/i18n/i18n.test.ts`) segnalano le traduzioni mancanti.
  - Numeri e durate si formattano con `src/i18n/format.ts`.
  - URL e identificativi sono in inglese; i commenti nel codice restano in italiano.
- **Fase attuale: niente login né backend.** I dati stanno in `localStorage` tramite `defineStore` (`src/lib/storage/local-store.ts`), sempre validati con zod.
- Il codice del login con Supabase è in `archivio/login/`, escluso da build, typecheck e lint. Account, Supabase, privacy definitiva e pubblicazione sono in `DA_FARE.md`: sono secondari, non vanno ripresi se l'utente non lo chiede.
- Priorità: migliorare e perfezionare l'app.
- Ordine dei moduli:
  - fatti: struttura ✅, Mente (giochi del mattino, con tempi di risposta) ✅, i18n en/it ✅, luce viva + Accendi ✅;
  - prossimi: onboarding (locale) → diario → palestra → alimentazione → insight → ciclo.
- Alla fine di ogni modulo:
  - test Vitest della logica di calcolo;
  - `npm run typecheck`, `npm run lint`, `npm run build`;
  - prova nel browser in formato mobile.
- Decisioni prese con l'utente:
  - età minima 14 anni (mese e anno di nascita);
  - dai 14 ai 17 anni niente obiettivo "dimagrire" né obiettivo calorico; ciclo solo da maggiorenni;
  - l'energia è un solo dato e sta nel diario;
  - tolleranza delle kcal sugli alimenti: 20% o 10 kcal.
- **Luce viva** (sfondo WebGL, src/components/light/):
  - sfondi in `src/lib/light/backgrounds.ts`, colori in `src/lib/light/palettes.ts` (10 temi, 4 ruoli: light/mid/deep/accent = `PAL_*` negli shader); scelta salvata con `appearance`;
  - mai colori fissi negli shader (tranne quelli "naturali", es. temperatura delle stelle): usare i ruoli della palette;
  - un nuovo sfondo = un fragment shader in `shader.ts` e una voce nei dizionari (`settings.background.options`);
  - ogni schermata ne imposta l'intensità con `useLightEnergy()` (client) o `<LightLevel>` (server);
  - gli eventi positivi mandano `pulseLight()`;
  - mai lampeggi rapidi (fotosensibilità): solo cambi lenti e un bagliore singolo;
  - livello di animazione 0..1 (`appearance.motion`, applicato da `MotionSync`): lo sfondo usa `uMotion` e un tempo che avanza a `timeScale(motion)`; il CSS usa `--motion`; con 0 o con "riduci movimento" tutto è fermo;
  - niente animazioni di comparsa sulle pagine normali (a ogni cambio scheda sembravano uno scatto): `.materialize` solo nelle schermate dei giochi;
  - tenere i testi sul vetro leggibili a ogni intensità;
  - in sviluppo `window.__light` permette di provarla dalla console.
- Stile grafico: linguaggio "Liquid Atlas" preso da `C:\Users\miris\Progetti\pathwyr-redesign-review` (solo lo stile, né contenuti né marchio). I token sono in `src/app/globals.css`.
- Regole di stile:
  - vetro solo per la cornice, card piatte dentro;
  - viola per i riempimenti, ciano per testi e link colorati.
- Vietati: API di database alimentari, AI/LLM, analytics di terze parti. Stripe e AI solo predisposti.
