const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function euro(value) {
  return '€ ' + Number(value || 0).toFixed(2).replace('.', ',');
}

function paymentText(value) {
  if (value === 'paid') return 'pagato online';
  if (value === 'cash_on_delivery') return 'pagamento al ritiro';
  if (value === 'checkout_created') return 'checkout creato';
  return 'in attesa del pagamento';
}

function buildMessage(order) {
  const createdAt = order.created_at
    ? new Date(order.created_at).toLocaleString('it-IT', { timeZone: 'Europe/Rome' })
    : '-';

  return [
    '🚚 <b>Nuova consegna Consegna24</b>',
    '',
    `<b>ID ordine:</b> ${escapeHtml(order.id)}`,
    `<b>Data:</b> ${escapeHtml(createdAt)}`,
    `<b>Cliente:</b> ${escapeHtml(order.user_email || '-')}`,
    '',
    `<b>Da:</b> ${escapeHtml(order.pickup_address || '-')}`,
    `<b>A:</b> ${escapeHtml(order.delivery_address || '-')}`,
    `<b>Fascia:</b> ${escapeHtml(order.delivery_slot || '-')}`,
    `<b>Prezzo:</b> ${escapeHtml(euro(order.price))}`,
    `<b>Pagamento:</b> ${escapeHtml(paymentText(order.payment_status))}`,
    `<b>Stato:</b> ${escapeHtml(order.status || '-')}`,
    '',
    `<b>Mittente:</b> ${escapeHtml(order.sender_name || '-')} · ${escapeHtml(order.sender_phone || '-')}`,
    `<b>Destinatario:</b> ${escapeHtml(order.receiver_name || '-')} · ${escapeHtml(order.receiver_phone || '-')}`,
    '',
    `<b>Cosa manda / note:</b> ${escapeHtml(order.package_description || '-')}`
  ].join('\n');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      return res.status(200).json({ ok: true, skipped: true, reason: 'Telegram env vars missing' });
    }

    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Login richiesto' });

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user?.email) {
      return res.status(401).json({ error: 'Sessione non valida' });
    }

    const { order_id } = req.body || {};
    if (!order_id) return res.status(400).json({ error: 'order_id mancante' });

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single();

    if (orderError || !order) return res.status(404).json({ error: 'Ordine non trovato' });
    if ((order.user_email || '').toLowerCase() !== userData.user.email.toLowerCase()) {
      return res.status(403).json({ error: 'Non autorizzato' });
    }

    const telegramRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: buildMessage(order),
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });

    const telegramJson = await telegramRes.json().catch(() => ({}));
    if (!telegramRes.ok) {
      return res.status(502).json({ error: telegramJson.description || 'Telegram notification failed' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Errore server Telegram' });
  }
};
