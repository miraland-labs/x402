# Shopify × pr402-link (minimal private app)

Minimal **custom app** scaffold: creates pr402 payment links on Shopify orders and processes pr402-link webhooks.

## Flow

1. Merchant installs app → OAuth → store `shop`, `merchantWallet`, `webhookSecret`, `pr402LinkBaseUrl`.
2. Shopify `orders/create` webhook → sign `POST /api/v1/links` → add `linkUrl` to order note.
3. pr402-link `link.paid` / `link.funded` → verify HMAC → Shopify Admin API mark order paid + tags.

## Setup

```bash
cd integrations/shopify-pr402
cp .env.example .env
npm install
npm run dev
```

## Environment

| Variable | Description |
|----------|-------------|
| `SHOPIFY_API_KEY` | Custom app client id |
| `SHOPIFY_API_SECRET` | Custom app secret |
| `SHOPIFY_SCOPES` | `read_orders,write_orders` |
| `APP_URL` | Public URL of this app |
| `PR402_LINK_BASE_URL` | e.g. `https://pay.ipay.sh` |
| `MERCHANT_WALLET` | pr402 merchant pubkey (dev default) |
| `MERCHANT_SIGNING_KEY` | Base58 secret for API auth (dev only) |

## Webhook events handled

| Event | Action |
|-------|--------|
| `link.paid` | Mark order paid, tag `x402-paid` |
| `link.funded` | Mark paid, tags `x402-paid`, `x402-escrow` |
| `link.shipped` | Create fulfillment with tracking |
| `link.released` | Order note + remove `x402-escrow` tag |
| `link.refunded` | Cancel order / refund note |
| `link.expired` | Cancel unpaid order |

## Notes

- Phase 0 does **not** use Shopify Payment App extensions; buyer pays via link URL in order note or email.
- Production: replace dev wallet signing with HSM or merchant backend signing service.

See [EVOLUTION_RFC.md](../../pr402-link/docs/EVOLUTION_RFC.md).
