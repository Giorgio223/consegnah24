const { ADMIN_EMAIL, authUser, getSingle, norm, rest, sendError } = require('../lib/api-helpers');

function isDelivered(status) {
  return norm(status).includes('consegnato');
}
function isCancelled(status) {
  return norm(status).includes('annullato');
}
function validTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ''));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function changedLine(label, before, after) {
  const oldValue = String(before ?? '').trim() || '-';
  const newValue = String(after ?? '').trim() || '-';
  if (oldValue === newValue) return null;
  return `<b>${escapeHtml(label)}:</b> ${escapeHtml(oldValue)} → ${escapeHtml(newValue)}`;
}
async function notifyClientEditTelegram(order, update) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return;

  const changes = [
    changedLine('Mittente', order.sender_name, update.sender_name),
    changedLine('Destinatario', order.receiver_name, update.receiver_name),
    changedLine('Note', order.package_description, update.package_description),
    changedLine('Consegna', order.delivery_slot, update.delivery_slot),
  ].filter(Boolean);
  if (!changes.length) return;

  const message = [
    '✏️ <b>Ordine modificato dal cliente</b>',
    '',
    `<b>ID ordine:</b> ${escapeHtml(order.id)}`,
    order.customer_reference ? `<b>Numero ordine cliente:</b> ${escapeHtml(order.customer_reference)}` : null,
    `<b>Cliente:</b> ${escapeHtml(order.user_email || '-')}`,
    `<b>Tratta:</b> ${escapeHtml(order.pickup_address || '-')} → ${escapeHtml(order.delivery_address || '-')}`,
    '',
    '<b>Modifiche:</b>',
    ...changes,
  ].filter(Boolean).join('\n');

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Telegram client edit notification failed: ${response.status} ${body}`);
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const user = await authUser(req);
    if (!user?.email) return res.status(401).json({ error: 'Sessione non valida' });

    // Modifica autonoma del cliente: solo i campi consentiti e solo sui propri ordini attivi.
    if (req.body?.action === 'client_edit') {
      const orderId = req.body?.order_id;
      if (!orderId) return res.status(400).json({ error: 'Ordine mancante' });
      const order = await getSingle('orders', { id: `eq.${orderId}` }, { maybe: true });
      if (!order) return res.status(404).json({ error: 'Ordine non trovato' });
      if (norm(order.user_email) !== norm(user.email)) return res.status(403).json({ error: 'Ordine non autorizzato' });
      if (isDelivered(order.status) || isCancelled(order.status)) {
        return res.status(409).json({ error: 'Una consegna conclusa o annullata non può essere modificata.' });
      }

      const senderName = String(req.body?.sender_name || '').trim();
      const receiverName = String(req.body?.receiver_name || '').trim();
      const notes = String(req.body?.package_description || '').trim();
      const deliveryDate = String(req.body?.delivery_date || '').trim();
      const timeFrom = String(req.body?.time_from || '').trim();
      const timeTo = String(req.body?.time_to || '').trim();
      if (!senderName || !receiverName || !/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate) || !validTime(timeFrom) || !validTime(timeTo)) {
        return res.status(400).json({ error: 'Dati della consegna non validi.' });
      }
      if (timeTo <= timeFrom) return res.status(400).json({ error: "L'orario finale deve essere successivo a quello iniziale." });
      const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
      if (deliveryDate < today) return res.status(400).json({ error: 'La data della consegna non può essere nel passato.' });

      const update = {
        sender_name: senderName,
        receiver_name: receiverName,
        package_description: notes,
        delivery_slot: `${deliveryDate} | ${timeFrom} - ${timeTo}`,
      };
      await rest('orders', {
        method: 'PATCH',
        query: { id: `eq.${orderId}` },
        prefer: 'return=minimal',
        body: update,
      });

      // L'ordine è già salvato: un eventuale problema Telegram non deve annullare la modifica.
      try {
        await notifyClientEditTelegram(order, update);
      } catch (telegramError) {
        console.error(telegramError);
      }

      return res.status(200).json({ ok: true, ...update });
    }

    // Cambio stato: resta riservato all'amministratore.
    if (norm(user.email) !== ADMIN_EMAIL) return res.status(403).json({ error: 'Solo amministratore' });
    const orderId = req.body?.order_id;
    const status = String(req.body?.status || '').trim();
    if (!orderId || !status) return res.status(400).json({ error: 'Dati mancanti' });

    const now = new Date().toISOString();
    const update = { status };
    if (isDelivered(status)) {
      update.delivered_to = String(req.body?.delivered_to || '').trim();
      update.delivered_at = now;
      if (!update.delivered_to) return res.status(400).json({ error: 'Indica a chi è stato consegnato' });
    } else {
      update.delivered_to = null;
      update.delivered_at = null;
    }

    await rest('orders', {
      method: 'PATCH',
      query: { id: `eq.${orderId}` },
      prefer: 'return=minimal',
      body: update,
    });
    await rest('order_status_history', {
      method: 'POST',
      prefer: 'return=minimal',
      body: { order_id: orderId, status, created_at: now },
    });
    return res.status(200).json({ ok: true, status, changed_at: now });
  } catch (error) {
    return sendError(res, error);
  }
};
