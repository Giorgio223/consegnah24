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
