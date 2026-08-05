const { ADMIN_EMAIL, authUser, getSingle, norm, randomToken, rest, sendError } = require('../lib/api-helpers');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const user = await authUser(req);
    if (!user) return res.status(401).json({ error: 'Accesso richiesto' });
    const orderId = req.body?.order_id;
    if (!orderId) return res.status(400).json({ error: 'ID ordine mancante' });
    const order = await getSingle('orders', { select: '*', id: `eq.${orderId}` }, { maybe: true });
    if (!order) return res.status(404).json({ error: 'Ordine non trovato' });
    if (norm(user.email) !== ADMIN_EMAIL && norm(order.user_email) !== norm(user.email)) {
      return res.status(403).json({ error: 'Non autorizzato' });
    }
    let token = order.tracking_token;
    if (!token) {
      token = randomToken();
      await rest('orders', {
        method: 'PATCH',
        query: { id: `eq.${order.id}` },
        prefer: 'return=minimal',
        body: { tracking_token: token },
      });
    }
    const history = await rest('order_status_history', {
      query: { select: 'id', order_id: `eq.${order.id}`, limit: '1' },
    });
    if (!Array.isArray(history) || history.length === 0) {
      const rows = [{
        order_id: order.id,
        status: 'Il corriere non è ancora partito',
        created_at: order.created_at || new Date().toISOString(),
      }];
      if (order.status && norm(order.status) !== norm('Il corriere non è ancora partito')) {
        rows.push({
          order_id: order.id,
          status: order.status,
          created_at: order.delivered_at || new Date().toISOString(),
        });
      }
      await rest('order_status_history', {
        method: 'POST',
        prefer: 'return=minimal',
        body: rows,
      });
    }
    return res.status(200).json({ tracking_token: token });
  } catch (error) {
    return sendError(res, error);
  }
};
