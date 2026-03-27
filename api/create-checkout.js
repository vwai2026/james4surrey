// Vercel Serverless Function — Stripe Checkout Session
// POST /api/create-checkout
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const DOMAIN = process.env.DOMAIN || 'https://james4surrey.ca';

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', DOMAIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      amount,        // in dollars (e.g. 50)
      recurring,     // boolean — monthly recurring
      firstName,
      lastName,
      email,
      phone,
      address,
      city,
      postalCode,
    } = req.body;

    // Validate amount
    const cents = Math.round(Number(amount) * 100);
    if (!cents || cents < 500 || cents > 500000) {
      return res.status(400).json({ error: 'Invalid amount. Min $5, Max $5,000.' });
    }

    // Build line item
    const lineItem = {
      price_data: {
        currency: 'cad',
        unit_amount: cents,
        product_data: {
          name: `Donation to James Yu Campaign`,
          description: recurring
            ? `Monthly $${amount} CAD donation`
            : `One-time $${amount} CAD donation`,
        },
        ...(recurring && { recurring: { interval: 'month' } }),
      },
      quantity: 1,
    };

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: recurring ? 'subscription' : 'payment',
      payment_method_types: ['card'],
      line_items: [lineItem],
      customer_email: email || undefined,
      success_url: `${DOMAIN}/donate-success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${DOMAIN}/pages/donate.html`,
      metadata: {
        donor_first_name: firstName || '',
        donor_last_name: lastName || '',
        donor_phone: phone || '',
        donor_address: address || '',
        donor_city: city || '',
        donor_postal: postalCode || '',
        campaign: 'james4surrey-2026',
      },
      // BC election compliance: collect billing address
      billing_address_collection: 'required',
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
