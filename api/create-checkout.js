module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  const DOMAIN = process.env.DOMAIN || 'https://james4surrey-deploy.vercel.app';

  if (!STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'STRIPE_SECRET_KEY not configured' });
  }

  try {
    const {
      amount, recurring, firstName, lastName, email,
      phone, address, city, postalCode,
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
          description: (recurring ? 'Monthly' : 'One-time') + ' $' + amount + ' CAD donation',
        },
      },
      quantity: 1,
    };

    if (recurring) {
      lineItem.price_data.recurring = { interval: 'month' };
    }

    const params = new URLSearchParams();
    params.append('mode', recurring ? 'subscription' : 'payment');
    params.append('payment_method_types[]', 'card');
    params.append('line_items[0][price_data][currency]', 'cad');
    params.append('line_items[0][price_data][unit_amount]', String(cents));
    params.append('line_items[0][price_data][product_data][name]', 'Donation to James Yu Campaign');
    if (recurring) {
      params.append('line_items[0][price_data][recurring][interval]', 'month');
    }
    params.append('line_items[0][quantity]', '1');
    params.append('success_url', DOMAIN + '/donate-success.html?session_id={CHECKOUT_SESSION_ID}');
    params.append('cancel_url', DOMAIN);
    params.append('billing_address_collection', 'required');
    if (email) params.append('customer_email', email);
    params.append('metadata[donor_first_name]', firstName || '');
    params.append('metadata[donor_last_name]', lastName || '');
    params.append('metadata[donor_phone]', phone || '');
    params.append('metadata[donor_address]', address || '');
    params.append('metadata[donor_city]', city || '');
    params.append('metadata[donor_postal]', postalCode || '');
    params.append('metadata[campaign]', 'james4surrey-2026');

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + STRIPE_SECRET_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Stripe API error:', data);
      return res.status(response.status).json({ error: data.error?.message || 'Stripe error' });
    }

    return res.status(200).json({ url: data.url });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: err.message });
  }
};
