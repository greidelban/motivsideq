# Schema del database

Postgres su Supabase (progetto in UE). Le migrazioni stanno in `supabase/migrations/`, si eseguono in ordine di nome e sono **la fonte di verità**: questo documento le riassume. Ogni `npm test` le prova su un Postgres in memoria (`src/lib/storage/schema.test.ts`); `npm run test:e2e` prova la sincronizzazione vera sul Supabase del PC.

## Il principio: il gestore non legge niente

Dal 4/10/2026 (migrazione `20261005090000_e2e_vault.sql`) i dati degli utenti arrivano al server **già cifrati** sul dispositivo, con una chiave che solo l'utente possiede (`src/lib/crypto/vault.ts`). Nel database non ci sono più tabelle con peso, profilo, diario, ciclo o allenamenti in chiaro.

| Cosa | Il gestore lo vede? |
|---|---|
| Email, date di registrazione e di accesso (Supabase Auth) | sì (servono per entrare e recuperare la password) |
| Piano (`free` / `pro`) | sì |
| Numero di righe, loro dimensione e date di modifica | sì |
| Contenuto, tipo di dato (peso, ciclo…), giorno a cui si riferisce | **no** |
| Chiave dei dati | **no**: c'è solo impacchettata con il codice di recupero |

Un test (`schema.test.ts`, "nessuna colonna con dati dell'utente in chiaro") elenca le colonne ammesse: una colonna nuova va aggiunta lì solo se il gestore può vederla.

## Migrazioni

| File | Contenuto |
|---|---|
| `20261003090000_core.sql` … `20261004150000_row_totals.sql` | prima versione (tabelle in chiaro), limiti giornalieri e totali, regola "vince l'ultima modifica" |
| `20261005090000_e2e_vault.sql` | toglie le tabelle in chiaro e crea `user_keys`, `vault_records`, `vault_usage`, `has_cloud()`, `reset_vault()` |

## Tabelle

### `profiles`
Una riga per utente, creata alla registrazione: `id`, `plan`, date. Il client la legge soltanto; `plan` lo cambierà la verifica degli acquisti in-app.

### `user_keys`
La chiave dati impacchettata (`wrapped_key`) con il codice di recupero, più la sua impronta (`key_id`).
- Inserita dal primo dispositivo (solo con l'abbonamento); un nuovo codice cambia solo `wrapped_key`; `key_id` non si cambia.
- Il codice di recupero ha 160 bit casuali: senza, `wrapped_key` è inutilizzabile.

### `vault_records`
Tutti i dati dell'utente, una riga per elemento:

| Colonna | Note |
|---|---|
| `id` | HMAC di (elenco, chiave dell'elemento): 64 caratteri esadecimali, non rivela tipo né giorno |
| `key_id` | impronta della chiave usata: se non è quella attuale la riga è rifiutata (`KY001`) |
| `payload` | `v1.` + AES-GCM (nonce casuale; l'id è dato associato); ≤ 256 kB |
| `created_at` | ora di arrivo sul server (quella vera di creazione è cifrata) |
| `updated_at` | ora della modifica sul telefono: decide i conflitti (vince la più recente) |
| `deleted_at` | cancellazione: il contenuto cifrato diventa vuoto, la riga resta come segnale |
| `server_updated_at` | scritto solo dal server: il telefono scarica ciò che è cambiato dopo l'ultima volta |

Chiave `(user_id, id)`. Il client può leggere le proprie righe e, con l'abbonamento, inserirle e aggiornarle; mai cancellarle.

### Limiti contro gli abusi
- **Al giorno** (`write_counters`, errore `RL001`): 50.000 righe nuove; l'app tiene i dati in coda e riprova il giorno dopo.
- **In totale** (`row_totals`, errore `RL002`): 500.000 righe.
- **Spazio** (`vault_usage`, errore `RL002`): 256 MB per utente; si può sempre accorciare una riga.
- Si contano solo le righe davvero nuove (un invio ritentato non consuma il limite due volte); le scritture del server non si contano. Nessuna di queste tabelle è leggibile dal client.

## Funzioni

| Funzione | Chi | Cosa fa |
|---|---|---|
| `has_cloud()` | policy | il piano dell'utente include il cloud? |
| `reset_vault()` | client | codice perso: cancella davvero righe cifrate e chiave dell'utente |
| `sync_guard()` | trigger | vince l'ultima modifica, date nel futuro riportate al presente |
| `vault_key_guard()` | trigger | piano attivo e chiave giusta, prima di ogni scrittura |
| `rate_limit_inserts()`, `vault_usage_track()` | trigger | limiti giornalieri, totali e di spazio |

## Cosa fa l'app (non il server)

- **Regole su età e Ciclo:** età minima 14 anni, niente dimagrimento né obiettivo calorico sotto i 18, Ciclo solo per donne maggiorenni con consenso. Il server non conosce sesso né data di nascita.
- **Export:** la copia di sicurezza in JSON si fa dall'app (Impostazioni), con i dati già decifrati sul dispositivo.
- **Rapporti, protezione e pillola:** se un giorno arriveranno, restano solo sul telefono (decisione con l'utente).

## Da fare

- **Pulizia periodica** delle righe cancellate da più di 180 giorni (pg_cron), abbassando anche `row_totals` (lo spazio si aggiorna da solo).
- **Cancellazione dell'account** dall'app (obbligatoria per l'App Store): tutto sparisce a cascata.
- **Cibo condiviso (fase C):** gli alimenti del database comune non sono dati personali e potranno stare in chiaro, senza collegamento a chi li ha creati.
- **Portachiavi su iPhone:** la chiave del dispositivo potrà passare al Portachiavi (anche sincronizzato con iCloud, così un nuovo iPhone non chiede il codice).
