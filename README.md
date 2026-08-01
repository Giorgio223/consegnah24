# Consegna24 — versione multipagina

Pagine:
- `index.html`: home, calcolo prezzo, login/registrazione e creazione ordine.
- `profilo.html`: profilo cliente e storico consegne.
- `ordine.html?id=...`: dettaglio ordine con timeline dello stato.
- `admin.html`: pannello amministratore con ricerca, filtri e cambio stato.

Stati e colori:
- grigio: `Il corriere non è ancora partito`
- giallo: `Il corriere ha visto l'ordine e sta arrivando`
- blu: `in consegna`
- verde: `consegnato!`
- rosso: `annullato`

La logica Supabase, Stripe e Telegram è inclusa. Caricare tutta la struttura mantenendo le cartelle `css`, `js`, `api` e `sql`.

## Ora di consegna nel profilo
Per gli ordini con stato `Consegnato`, il profilo cliente mostra sotto il badge verde la dicitura `alle HH:MM`, usando il campo Supabase `delivered_at` già esistente.


## Pulsante Nuova consegna
Nella pagina `ordine.html` è presente il pulsante **Nuova consegna**, che riporta direttamente al calcolatore della pagina principale (`/#quoteForm`).

## Nuovo hero H24
La pagina principale usa una foto ottimizzata in `assets/duomo-h24.jpg` come sfondo visivo. I pulsanti non fanno parte dell'immagine: sono veri link HTML e quindi sono cliccabili.

- `Calcola la tua consegna` porta alla sezione del preventivo.
- `Come funziona` porta alla sezione informativa.

## Modifica ordini dall'admin
Nel pannello `admin.html` ogni ordine ha ora il pulsante **Modifica**. L'amministratore può correggere:
- indirizzo di partenza e destinazione;
- mittente e destinatario;
- telefoni;
- fascia oraria;
- prezzo;
- stato del pagamento;
- oggetto e note.

Le modifiche vengono salvate direttamente nella stessa riga della tabella Supabase `orders`, quindi il cliente le vede subito nel profilo e nella pagina del dettaglio ordine.

Gli ordini con stato **Annullato** rimangono visibili nello storico, ma non vengono conteggiati nel numero delle consegne valide né nel totale economico del profilo e dell'admin.


## Tariffe aggiornate (12 luglio 2026)

- Nuovi account: € 11,99 fino a 10 km, più € 1,00 per ogni km oltre i 10 km.
- Account creati prima del cutoff `2026-07-12T14:57:29Z`: mantengono la tariffa storica (minimo € 8,99, poi € 0,90/km).
- Il riconoscimento del cliente storico usa `auth.users.created_at` restituito da Supabase Auth.
- La tariffa viene ricalcolata dopo il login e nuovamente prima del salvataggio dell'ordine.

Esempio nuova tariffa: 40 km = € 11,99 + 30 km × € 1,00 = € 41,99.


## Aggiornamento data di consegna
- Il cliente seleziona una data dal calendario e una fascia oraria di 2 ore.
- La data e la fascia vengono salvate insieme nel campo `delivery_slot`, quindi non serve una nuova migrazione Supabase.
- Le indicazioni visibili sui clienti storici/nuovi sono state rimosse, mantenendo invariata la logica tariffaria.

## Fatturato azienda (admin)

Nella pagina `admin.html` è disponibile il pannello **Fatturato azienda**:

- selezione del cliente tramite email;
- selezione del periodo con calendario `Dal / Al`;
- totale degli ordini validi e importo dovuto;
- esclusione automatica degli ordini con stato `annullato`;
- riepilogo per prezzo (quantità × prezzo unitario = subtotale);
- esportazione in Excel con fogli `Riepilogo`, `Dettaglio ordini` e `Ordini annullati`;
- stampa o salvataggio in PDF tramite il comando di stampa del browser.

Il riepilogo è un documento gestionale e non sostituisce una fattura fiscale.

## Gestione email e password cliente dall’admin

In `admin.html` è disponibile la sezione **Gestione clienti**. L’amministratore può selezionare un cliente, cambiare il suo indirizzo email e, facoltativamente, impostare una nuova password.

La funzione server `api/update-client-credentials.js`:

- verifica il token Supabase dell’amministratore;
- mantiene lo stesso Supabase User ID;
- aggiorna `auth.users` tramite Supabase Admin API;
- aggiorna `orders.user_email` per conservare tutto lo storico nel profilo;
- libera il vecchio indirizzo email, che potrà essere usato per registrare un nuovo account;
- non espone mai `SUPABASE_SERVICE_ROLE_KEY` nel browser.

Variabili Vercel richieste:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- facoltativa: `ADMIN_EMAIL` (se assente usa `angiorgio6@gmail.com`)

Dopo il deploy, eseguire un nuovo deployment per rendere disponibile la funzione API.


## Disconnessione del cliente da tutti i dispositivi

Nel pannello **Gestione clienti** è presente l'opzione **Disconnetti il cliente da tutti i dispositivi**. Quando è attiva, l'amministratore deve impostare una nuova password. L'API aggiorna le credenziali, registra in `user_metadata.force_logout_after` il momento della modifica e la variazione della password invalida le sessioni di rinnovo Supabase.

Tutte le pagine eseguono inoltre un controllo della sessione all'apertura, quando la scheda torna visibile e ogni minuto. Se rilevano un token emesso prima della modifica delle credenziali, effettuano il logout locale e rimandano alla pagina di accesso. Gli access token JWT già emessi possono tecnicamente restare validi fino alla loro scadenza, ma l'interfaccia forza il logout non appena il dispositivo torna attivo e riesce a contattare Supabase.
