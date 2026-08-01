const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = String(process.env.ADMIN_EMAIL || 'angiorgio6@gmail.com').trim().toLowerCase();

function json(res, status, payload) {
  res.status(status).json(payload);
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function findUserByEmail(supabaseAdmin, email) {
  const wanted = normalizeEmail(email);
  const perPage = 1000;
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users || [];
    const found = users.find(user => normalizeEmail(user.email) === wanted);
    if (found) return found;
    if (users.length < perPage) break;
  }
  return null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  if (!supabaseUrl || !serviceRoleKey) return json(res, 500, { error: 'Configurazione Supabase server incompleta' });

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    const authorization = req.headers.authorization || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!token) return json(res, 401, { error: 'Accesso richiesto' });

    const { data: adminData, error: adminError } = await supabaseAdmin.auth.getUser(token);
    const requesterEmail = normalizeEmail(adminData?.user?.email);
    if (adminError || !adminData?.user || requesterEmail !== adminEmail) {
      return json(res, 403, { error: 'Operazione riservata all’amministratore' });
    }

    const oldEmail = normalizeEmail(req.body?.old_email);
    const newEmail = normalizeEmail(req.body?.new_email);
    const password = String(req.body?.new_password || '');

    if (!validEmail(oldEmail) || !validEmail(newEmail)) {
      return json(res, 400, { error: 'Indirizzo email non valido' });
    }
    if (oldEmail === adminEmail) return json(res, 400, { error: 'Non puoi modificare l’account amministratore da questa funzione' });
    if (newEmail === adminEmail) return json(res, 409, { error: 'Il nuovo indirizzo è riservato all’amministratore' });
    if (password && password.length < 8) return json(res, 400, { error: 'La nuova password deve contenere almeno 8 caratteri' });

    const targetUser = await findUserByEmail(supabaseAdmin, oldEmail);
    if (!targetUser) return json(res, 404, { error: 'Cliente non trovato in Supabase Auth' });

    if (newEmail !== oldEmail) {
      const existingUser = await findUserByEmail(supabaseAdmin, newEmail);
      if (existingUser && existingUser.id !== targetUser.id) {
        return json(res, 409, { error: 'Il nuovo indirizzo email è già utilizzato da un altro account' });
      }
    }

    let changedOrders = [];
    if (newEmail !== oldEmail) {
      const { data: updatedOrders, error: ordersError } = await supabaseAdmin
        .from('orders')
        .update({ user_email: newEmail })
        .ilike('user_email', oldEmail)
        .select('id');
      if (ordersError) throw ordersError;
      changedOrders = updatedOrders || [];
    }

    const authChanges = { email_confirm: true };
    if (newEmail !== oldEmail) authChanges.email = newEmail;
    if (password) authChanges.password = password;

    const { data: updatedAuth, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(targetUser.id, authChanges);
    if (updateError) {
      if (newEmail !== oldEmail && changedOrders.length) {
        await supabaseAdmin.from('orders').update({ user_email: oldEmail }).in('id', changedOrders.map(row => row.id));
      }
      throw updateError;
    }

    return json(res, 200, {
      ok: true,
      user_id: targetUser.id,
      old_email: oldEmail,
      new_email: normalizeEmail(updatedAuth?.user?.email || newEmail),
      password_changed: Boolean(password),
      orders_updated: changedOrders.length
    });
  } catch (error) {
    console.error('update-client-credentials:', error);
    return json(res, 500, { error: error.message || 'Errore durante la modifica del cliente' });
  }
};
