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
