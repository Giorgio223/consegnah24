const { getSingle, rest, sendError } = require('../lib/api-helpers');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));
}

function badge(status) {
  const value = String(status || '').toLowerCase();
  let text = 'Ordine ricevuto';
  let color = 'gray';
  if (value.includes('annull')) { text = 'Annullato'; color = 'red'; }
  else if (value.includes('consegnato')) { text = 'Consegnato'; color = 'green'; }
  else if (value.includes('in consegna')) { text = 'In consegna'; color = 'blue'; }
  else if (value.includes('ha visto') || value.includes('sta arrivando')) {
    text = "Il corriere ha visto l'ordine e sta arrivando";
    color = 'yellow';
  }
  return `<span class="status ${color}"><span class="dot"></span>${escapeHtml(text)}</span>`;
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const token = String(req.query?.token || '');
    if (!/^[a-f0-9]{48}$/.test(token)) return res.status(400).json({ error: 'Link tracking non valido' });
    const order = await getSingle('orders', {
      select: 'id,status,created_at,delivered_at',
      tracking_token: `eq.${token}`,
    }, { maybe: true });
    if (!order) return res.status(404).json({ error: 'Tracking non trovato' });
    let history = await rest('order_status_history', {
      query: {
        select: 'status,created_at',
        order_id: `eq.${order.id}`,
        order: 'created_at.asc',
      },
    });
    if (!Array.isArray(history) || history.length === 0) {
      history = [{ status: order.status, created_at: order.delivered_at || order.created_at }];
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ current_status_html: badge(order.status), history });
  } catch (error) {
    return sendError(res, error);
  }
};
