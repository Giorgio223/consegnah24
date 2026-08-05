const { ADMIN_EMAIL, authUser, findUserByEmail, norm, rest, sendError } = require('../lib/api-helpers');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const admin = await authUser(req);
    if (norm(admin?.email) !== ADMIN_EMAIL) return res.status(403).json({ error: 'Solo amministratore' });
    const email = norm(req.body?.email);
    const mode = String(req.body?.mode || '');
    if (!email) return res.status(400).json({ error: 'Email cliente mancante' });
    if (!['storico', 'piena'].includes(mode)) return res.status(400).json({ error: 'Tariffa non valida' });
    const user = await findUserByEmail(email);
    if (!user) return res.status(404).json({ error: 'Cliente non trovato' });
    await rest('client_tariffs', {
      method: 'POST',
      query: { on_conflict: 'user_id' },
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: {
        user_id: user.id,
        email: user.email,
        tariff_mode: mode,
        updated_at: new Date().toISOString(),
      },
    });
    return res.status(200).json({ ok: true, mode });
  } catch (error) {
    return sendError(res, error);
  }
};
