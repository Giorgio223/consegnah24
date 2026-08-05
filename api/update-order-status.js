const { ADMIN_EMAIL, authUser, norm, rest, sendError } = require('../lib/api-helpers');

function isDelivered(status) {
  return norm(status).includes('consegnato');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const admin = await authUser(req);
    if (norm(admin?.email) !== ADMIN_EMAIL) return res.status(403).json({ error: 'Solo amministratore' });
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
