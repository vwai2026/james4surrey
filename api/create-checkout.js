const https = require('https');

function stripeRequest(secretKey, params) {
  return new Promise((resolve, reject) => {
    const body = params.toString();
    const options = {
      hostname: 'api.stripe.com',
      port: 443,
      path: '/v1/checkout/sessions',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + secretKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { reject(new Error('Invalid JSON: ' + data.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

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

    const result = await stripeRequest(STRIPE_SECRET_KEY, params);

    if (result.status !== 200) {
      console.error('Stripe API error:', JSON.stringify(result.body));
      return res.status(result.status).json({ error: result.body?.error?.message || 'Stripe error' });
    }

    return res.status(200).json({ url: result.body.url });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: err.message });
  }
};
