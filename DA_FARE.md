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
- [ ] Abbonamento con Stripe: tabella `subscriptions`, webhook che aggiorna `profiles.plan`, `can()` in `src/lib/entitlements.ts`.
- [ ] AI lato server: tabella `ai_usage`, controllo del piano, consenso separato per diario e ciclo.
