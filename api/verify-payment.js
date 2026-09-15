const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { session_id } = req.body || {};
    if (!session_id) return res.status(400).json({ error: 'session_id mancante' });

    const session = await stripe.checkout.sessions.retrieve(session_id);
    const orderId = session.metadata?.order_id;

    if (!orderId) return res.status(400).json({ error: 'order_id mancante nella sessione Stripe' });

    if (session.payment_status === 'paid') {
      const { error } = await supabaseAdmin
        .from('orders')
        .update({
          payment_status: 'paid',
          status: 'Il corriere non è ancora partito',
          stripe_session_id: session.id,
          stripe_payment_intent: session.payment_intent || null
        })
        .eq('id', orderId);

      if (error) throw error;
      return res.status(200).json({ ok: true, paid: true, order_id: orderId });
    }

    return res.status(200).json({ ok: true, paid: false, payment_status: session.payment_status, order_id: orderId });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Errore verifica pagamento' });
  }
};
