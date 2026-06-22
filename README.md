# Consegna24 updated

Changes added:

1. When admin selects `consegnato!`, a modal opens: `A chi hai consegnato?`.
2. Admin must fill `Consegnato a:` before confirming delivery.
3. The order is updated with:
   - `status = consegnato!`
   - `delivered_to = admin note`
   - `delivered_at = current timestamp`
4. Client profile and admin panel show:
   - `Consegnato a:`
   - `Consegnato il:`
5. Non-admin profile query is filtered by the logged-in user's email.

## Supabase migration

Run this file in Supabase SQL Editor before deploying:

```sql
sql/001_add_delivery_confirmation_fields.sql
```

## Deploy files

- `index.html` to site root
- `favicon.png`, `favicon.svg`, `robots.txt`, `sitemap.xml`, `llms.txt` to site root
- `api/create-checkout-session.js`
- `api/stripe-webhook.js`
- `api/verify-payment.js`
- `package.json`

Telegram notifications are not added yet, per request. They can be added later after creating the bot and getting the chat ID.


## Telegram notifications

Per ricevere in Telegram ogni nuova consegna creata dai clienti:

1. Crea un bot con @BotFather e copia il token.
2. Scrivi almeno un messaggio al bot dal tuo account Telegram.
3. Apri `https://api.telegram.org/bot<TOKEN>/getUpdates` e copia il tuo `chat.id`.
4. Su Vercel aggiungi queste Environment Variables:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
5. Redeploy del progetto.

Quando un cliente salva una consegna, il sito chiama `/api/send-telegram-notification` e invia in chat tutti i dati dell’ordine.
