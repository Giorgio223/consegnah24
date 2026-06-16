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
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Login richiesto' });

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user?.email) return res.status(401).json({ error: 'Sessione non valida' });

    const { order_id } = req.body || {};
    if (!order_id) return res.status(400).json({ error: 'order_id mancante' });

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single();

    if (orderError || !order) return res.status(404).json({ error: 'Ordine non trovato' });
    if ((order.user_email || '').toLowerCase() !== userData.user.email.toLowerCase()) {
      return res.status(403).json({ error: 'Non autorizzato' });
    }

    const amount = Math.round(Number(order.price) * 100);
    if (!amount || amount < 50) return res.status(400).json({ error: 'Prezzo non valido' });

    const baseUrl = process.env.SITE_URL || process.env.PUBLIC_SITE_URL || 'https://www.consegnah24.it';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: userData.user.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: amount,
            product_data: {
              name: 'Consegna24 - consegna express',
              description: `${order.pickup_address || ''} → ${order.delivery_address || ''}${order.delivery_slot ? ' · ' + order.delivery_slot : ''}`.slice(0, 250)
            }
          }
        }
      ],
      metadata: {
        order_id: String(order.id),
        user_email: userData.user.email
      },
      success_url: `${baseUrl}/?payment=success&session_id={CHECKOUT_SESSION_ID}&order=${order.id}`,
      cancel_url: `${baseUrl}/?payment=cancel&order=${order.id}`
    });

    await supabaseAdmin
      .from('orders')
      .update({ stripe_session_id: session.id, payment_status: 'checkout_created' })
      .eq('id', order.id);

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Errore server' });
  }
};
