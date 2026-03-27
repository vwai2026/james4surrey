const Stripe = require('stripe');

module.exports = async function handler(req, res) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const DOMAIN = process.env.DOMAIN || 'https://james4surrey-deploy.vercel.app';

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      amount,
      recurring,
      firstName,
      lastName,
      email,
      phone,
      address,
      city,
      postalCode,
    } = req.body || {};

    const cents = Math.round(Number(amount) * 100);
    if (!cents || cents < 500 || cents > 500000) {
      return res.status(400).json({ error: 'Invalid amount. Min $5, Max $5,000.' });
    }

    const lineItem = {
      price_data: {
        currency: 'cad',
        unit_amount: cents,
        product_data: {
          name: 'Donation to James Yu Campaign',
          description: recurring
            ? 'Monthly $' + amount + ' CAD donation'
            : 'One-time $' + amount + ' CAD donation',
        },
      },
      quantity: 1,
    };

    if (recurring) {
      lineItem.price_data.recurring = { interval: 'month' };
    }

    const sessionParams = {
      mode: recurring ? 'subscription' : 'payment',
      payment_method_types: ['card'],
      line_items: [lineItem],
      success_url: DOMAIN + '/donate-success.html?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: DOMAIN,
      metadata: {
        donor_first_name: firstName || '',
        donor_last_name: lastName || '',
        donor_phone: phone || '',
        donor_address: address || '',
        donor_city: city || '',
        donor_postal: postalCode || '',
        campaign: 'james4surrey-2026',
      },
      billing_address_collection: 'required',
    };

    if (email) {
      sessionParams.customer_email = email;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err);
    return res.status(500).json({ error: err.message });
  }
};
