/**
 * Minimal Shopify × pr402-link integration server.
 * Scaffold — extend with OAuth session storage and wallet signing for production.
 */
import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';

const app = express();
app.use(express.json({ verify: rawBodySaver }));
const rawBodies = new WeakMap();

function rawBodySaver(req, _res, buf) {
  rawBodies.set(req, buf);
}

const PR402_BASE = process.env.PR402_LINK_BASE_URL || 'http://localhost:3000';
const MERCHANT_WALLET = process.env.MERCHANT_WALLET || '';

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'shopify-pr402' });
});

/** Shopify orders/create → create pr402 payment link (stub: logs + returns link payload). */
app.post('/webhooks/shopify/orders-create', async (req, res) => {
  const order = req.body;
  const orderId = String(order.id);
  const amountRaw = Math.round(parseFloat(order.total_price || '0') * 1_000_000);

  // TODO: wallet-signed POST /api/v1/links (see pr402-link HANDOVER.md auth)
  console.log('[shopify-pr402] order', orderId, 'amountRaw', amountRaw, '→ create link at', PR402_BASE);

  res.status(200).send('OK');
});

/** pr402-link merchant webhooks → Shopify order updates. */
app.post('/webhooks/pr402', (req, res) => {
  const secret = process.env.PR402_WEBHOOK_SECRET || '';
  const sig = req.headers['x-pr402-signature'] || '';
  const ts = req.headers['x-pr402-timestamp'] || '';
  const raw = rawBodies.get(req) || Buffer.from(JSON.stringify(req.body));
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${ts}.${raw.toString('utf8')}`)
    .digest('hex');

  if (secret && sig !== `sha256=${expected}`) {
    return res.status(401).json({ error: 'invalid signature' });
  }

  const event = req.body.event;
  const externalOrderId = req.body.externalOrderId;
  console.log('[shopify-pr402] pr402 event', event, 'order', externalOrderId);

  switch (event) {
    case 'link.paid':
    case 'link.funded':
      // TODO: Shopify Admin API — mark order paid, add tags
      break;
    case 'link.shipped':
      // TODO: fulfillmentCreate with tracking
      break;
    case 'link.released':
      // TODO: order note, remove x402-escrow tag
      break;
    case 'link.refunded':
    case 'link.expired':
      // TODO: cancel or annotate order
      break;
    default:
      break;
  }

  res.status(200).json({ received: true });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`shopify-pr402 listening on :${port}`);
});
