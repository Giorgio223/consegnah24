# Consegna24 — aggiornamento stati corriere

## Modifiche incluse

- Ogni nuovo ordine nasce con lo stato: `Il corriere non è ancora partito`.
- Nell'admin panel è disponibile il nuovo stato: `Il corriere ha visto l'ordine e sta arrivando`.
- Restano disponibili anche: `in consegna`, `consegnato!`, `annullato`.
- Colori scelti:
  - grigio: corriere non ancora partito;
  - blu animato: ordine visto, corriere in arrivo;
  - giallo: in consegna;
  - verde: consegnato;
  - rosso: annullato/non pagato.
- Stripe webhook e verifica pagamento mantengono lo stato iniziale, senza dichiarare automaticamente che il corriere è in arrivo.
- Gli ordini vecchi con `Corriere in arrivo`, `in gestione` o `presa in gestione` vengono mostrati come `Il corriere non è ancora partito` finché l'admin non cambia lo stato.

## Struttura di deploy

- File della root: `index.html`, favicon, `robots.txt`, `sitemap.xml`, `llms.txt`, `package.json`.
- Funzioni serverless nella cartella `api/`.
- Migrazione Supabase nella cartella `sql/`.

## Variabili d'ambiente richieste

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SITE_URL` oppure `PUBLIC_SITE_URL`
- `TELEGRAM_BOT_TOKEN` (facoltativa)
- `TELEGRAM_CHAT_ID` (facoltativa)
