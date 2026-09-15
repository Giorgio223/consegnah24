const crypto = require('crypto');

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || 'angiorgio6@gmail.com').trim().toLowerCase();

function assertConfig() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    const error = new Error('Configurazione Supabase mancante sul server.');
    error.status = 500;
    throw error;
  }
}

function norm(value) {
  return String(value || '').trim().toLowerCase();
}

function tokenFrom(req) {
  const value = String(req.headers?.authorization || '');
  return value.startsWith('Bearer ') ? value.slice(7).trim() : '';
}

async function parseResponse(response) {
  const text = await response.text();
  let payload = null;
  if (text) {
    try { payload = JSON.parse(text); }
    catch { payload = { message: text }; }
  }
  if (!response.ok) {
    const message = payload?.message || payload?.msg || payload?.error_description || payload?.error || `Errore Supabase (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

function serviceHeaders(extra = {}) {
  assertConfig();
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    ...extra,
  };
}

async function authUser(req) {
  assertConfig();
  const token = tokenFrom(req);
  if (!token) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  if (response.status === 401 || response.status === 403) return null;
  return parseResponse(response);
}

async function findUserByEmail(email) {
  assertConfig();
  const wanted = norm(email);
  for (let page = 1; page <= 50; page += 1) {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=1000`, {
      headers: serviceHeaders(),
    });
    const payload = await parseResponse(response);
    const users = Array.isArray(payload?.users) ? payload.users : [];
    const found = users.find((user) => norm(user.email) === wanted);
    if (found) return found;
    if (users.length < 1000) break;
  }
  return null;
}

function encodeQuery(query = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  });
  const text = params.toString();
  return text ? `?${text}` : '';
}

async function rest(table, { method = 'GET', query = {}, body, prefer, single = false } = {}) {
  assertConfig();
  const headers = serviceHeaders({ Accept: 'application/json' });
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;
  if (single) headers.Accept = 'application/vnd.pgrst.object+json';
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}${encodeQuery(query)}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 204) return null;
  return parseResponse(response);
}

async function getSingle(table, query, { maybe = false } = {}) {
  try {
    return await rest(table, { query, single: true });
  } catch (error) {
    if (maybe && error.status === 406) return null;
    throw error;
  }
}

function randomToken() {
  return crypto.randomBytes(24).toString('hex');
}

function sendError(res, error) {
  const status = Number(error?.status) >= 400 && Number(error?.status) < 600 ? Number(error.status) : 500;
  return res.status(status).json({ error: error?.message || 'Errore server.' });
}

module.exports = {
  ADMIN_EMAIL,
  SUPABASE_URL,
  SERVICE_KEY,
  authUser,
  findUserByEmail,
  getSingle,
  norm,
  randomToken,
  rest,
  sendError,
  serviceHeaders,
  tokenFrom,
};
