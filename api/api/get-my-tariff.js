const { authUser, getSingle, sendError } = require('../lib/api-helpers');
const CUTOFF = Date.parse('2026-07-12T14:57:29Z');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const user = await authUser(req);
    if (!user) return res.status(401).json({ error: 'Accesso richiesto' });
    const data = await getSingle('client_tariffs', {
      select: 'tariff_mode',
      user_id: `eq.${user.id}`,
    }, { maybe: true });
    const mode = data?.tariff_mode || (Date.parse(user.created_at) < CUTOFF ? 'storico' : 'piena');
    return res.status(200).json({ mode });
  } catch (error) {
    return sendError(res, error);
  }
};
