require('dotenv').config();
console.log('Stripe key starts with:', process.env.STRIPE_SECRET_KEY?.slice(0, 8));

const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();

app.use(cors());
app.use(express.json());

app.post('/create-checkout-session', async (req, res) => {
  try {
    const { items, customer } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items provided.' });
    }

    // Build Stripe line items from the cart contents
    const line_items = items.map((item) => {
      let name = item.name || 'DIY Balustrades Item';
      let description;

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
        if (details.length) description = details.join(' | ');
      }

      const product_data = { name };
      if (description) product_data.description = description;

      return {
        price_data: {
          currency: 'gbp',
          product_data,
          unit_amount: Math.round(item.price * 100), // £ -> pence
        },
        quantity: item.quantity || 1,
      };
    });

    const sessionConfig = {
      payment_method_types: ['card'],
      mode: 'payment',
      line_items,
      shipping_address_collection: {
        allowed_countries: ['GB'],
      },
      success_url: 'https://diybalustrades.co.uk/success.html',
      cancel_url: 'https://diybalustrades.co.uk/cancel.html',
    };

    // Attach customer email so Stripe pre-fills it and sends receipts
    if (customer && customer.email) {
      sessionConfig.customer_email = customer.email;
    }

    // Pass through customer details as metadata for order fulfilment reference
    if (customer) {
      sessionConfig.metadata = {
        first_name: customer.firstName || '',
        last_name: customer.lastName || '',
        phone: customer.phone || '',
        address1: customer.address1 || '',
        address2: customer.address2 || '',
        city: customer.city || '',
        postcode: customer.postcode || '',
        notes: customer.notes || '',
      };
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    res.json({ url: session.url });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

const PORT = process.env.PORT || 4242;
app.listen(PORT, () => {
  console.log(`Stripe server running on port ${PORT}`);
});
