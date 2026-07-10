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
