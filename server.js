const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Stripe backend is running');
});

app.post('/create-checkout-session', async (req, res) => {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeKey) {
      console.error('Missing STRIPE_SECRET_KEY in Railway Variables');
      return res.status(500).json({ error: 'Stripe secret key is missing.' });
    }

    const stripe = require('stripe')(stripeKey);

    const { items, customer } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items provided.' });
    }

    const line_items = items.map((item) => {
      const name = item.name || 'DIY Balustrades Item';
      const price = Number(String(item.price).replace(/[^\d.]/g, ''));
      const quantity = Number(item.quantity) || 1;

      if (!price || price <= 0) {
        throw new Error(`Invalid price for item: ${name}`);
      }

      let description = '';

      if (item.builderData) {
        const d = item.builderData;
        const details = [];

        if (d.system) details.push(`System: ${d.system}`);
        if (d.layout) details.push(`Layout: ${d.layout}`);
        if (d.length) details.push(`Length: ${d.length}`);
        if (d.height) details.push(`Height: ${d.height}`);
        if (d.corners) details.push(`Corners: ${d.corners}`);
        if (d.finish) details.push(`Finish: ${d.finish}`);
        if (d.mounting) details.push(`Mounting: ${d.mounting}`);

        description = details.join(' | ');
      }

      const product_data = { name };

      if (description) {
        product_data.description = description;
      }

      return {
        price_data: {
          currency: 'gbp',
          product_data,
          unit_amount: Math.round(price * 100)
        },
        quantity
      };
    });

    const sessionConfig = {
      payment_method_types: ['card'],
      mode: 'payment',
      line_items,
      shipping_address_collection: {
        allowed_countries: ['GB']
      },
      success_url: 'https://diybalustrades.co.uk/success.html',
      cancel_url: 'https://diybalustrades.co.uk/cancel.html',
      metadata: {
        first_name: customer?.firstName || '',
        last_name: customer?.lastName || '',
        email: customer?.email || '',
        phone: customer?.phone || '',
        address1: customer?.address1 || '',
        address2: customer?.address2 || '',
        city: customer?.city || '',
        postcode: customer?.postcode || '',
        notes: customer?.notes || ''
      }
    };

    if (customer?.email) {
      sessionConfig.customer_email = customer.email;
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    res.json({ url: session.url });
  } catch (err) {
    console.error('Checkout error:', err.message);
    res.status(500).json({ error: err.message || 'Something went wrong.' });
  }
});

const PORT = process.env.PORT || 4242;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Stripe server running on http://0.0.0.0:${PORT}`);
});
