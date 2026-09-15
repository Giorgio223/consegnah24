const { authUser, getSingle, norm, rest, sendError } = require('../lib/api-helpers');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const user = await authUser(req);
    if (!user) return res.status(401).json({ error: 'Accesso richiesto' });
    const orderId = req.body?.order_id;
    if (!orderId) return res.status(400).json({ error: 'ID ordine mancante' });
    const order = await getSingle('orders', { select: '*', id: `eq.${orderId}` }, { maybe: true });
    if (!order) return res.status(404).json({ error: 'Ordine non trovato' });
    if (norm(order.user_email) !== norm(user.email)) return res.status(403).json({ error: 'Non autorizzato' });
    const existing = await rest('order_status_history', {
      query: { select: 'id', order_id: `eq.${order.id}`, limit: '1' },
    });
    if (!Array.isArray(existing) || existing.length === 0) {
      await rest('order_status_history', {
        method: 'POST',
        prefer: 'return=minimal',
        body: {
          order_id: order.id,
          status: order.status || 'Il corriere non è ancora partito',
          created_at: order.created_at || new Date().toISOString(),
        },
      });
    }
    return res.status(200).json({ ok: true });
  } catch (error) {
    return sendError(res, error);
  }
};
