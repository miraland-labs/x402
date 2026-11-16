# MCP, SDK, and CLI paths

## MCP — Cursor / Claude Desktop (fastest for agents)

**Package:** `@pr402/mcp-server` (stdio over `@pr402/client`)

```bash
npx -y @pr402/mcp-server
```

**`.cursor/mcp.json` example** (from [x402-buyer-starter](https://github.com/miraland-labs/x402-buyer-starter/blob/main/examples/mcp/cursor-mcp.json)):

```json
{
  "mcpServers": {
    "pr402": {
      "command": "npx",
      "args": ["-y", "@pr402/mcp-server"],
      "env": {
        "PR402_FACILITATOR_URL": "https://ipay.sh",
        "PR402_PAYER_KEYPAIR_JSON": "/absolute/path/to/buyer-keypair.json"
      }
    }
  }
}
```

**Buyer and discovery tools:**

- `pr402_get_capabilities`
- `pr402_build_exact_payment`
- `pr402_pay_http_resource` — end-to-end paid HTTP fetch
- `pr402_search_resources` — search payable endpoints
- `pr402_probe_resource` — unpaid 402 probe

**Seller tools** (same server — useful when agent helps onboard):

- `pr402_seller_preview`, `pr402_seller_rail_info`, `pr402_seller_provision_tx`, `pr402_enrich_payment_required`

Devnet testing: set `PR402_FACILITATOR_URL` to `https://preview.ipay.sh` and use a funded Devnet keypair.

Source: [miralandlabs/pr402/sdk/mcp](https://github.com/miralandlabs/pr402/tree/main/sdk/mcp)

Use `@pr402/mcp-server` 0.1.4 or newer; discovery support is packaged directly with no local `file:` dependency.

## TypeScript SDK

**Production default:** `@pr402/client` (facilitator client + CLI)

```bash
npm install @pr402/client
```

```typescript
import { X402AgentClient } from "@pr402/client";

const client = new X402AgentClient(payer, {
  maxPaymentAmount: "1000000", // atomic units
});
const res = await client.fetchWithAutoPay(url, preferredMint, init);
```

The client accepts only Solana `exact`, trusts the four official pr402 origins by default, verifies immutable payment terms and the payer signer slot, and emits base64 JSON in `PAYMENT-SIGNATURE`.

For a self-hosted facilitator, opt in explicitly:

```typescript
const client = new X402AgentClient(payer, {
  trustedFacilitatorOrigins: ["https://facilitator.example.com"],
  maxPaymentAmount: "1000000",
});
```

`@pr402/buyer-typescript` remains useful as starter/demo code, but its current signing path does not enforce all safeguards above. Add equivalent checks before production use.

## Global CLI

```bash
npm i -g @pr402/client
pr402-buy --resource <url> --payer /path/keypair.json --mint <mint>
```

Rust equivalent: `cargo install pr402-client`

## Python

Starter: `x402-buyer-starter/python` — `pip install -r requirements.txt && python index.py`

## Bash (minimal)

`x402-buyer-starter/bash` — curl + Node `sign.js` for Ed25519.

Conventions:

- `set -e`
- Top-level JSON `"error"` → non-zero exit
- `node --no-deprecation sign.js` to suppress punycode noise
- `PR402_FACILITATOR_URL` overrides default (`https://ipay.sh` in production examples)

## Environment variables

| Variable | Purpose |
| --- | --- |
| `PR402_FACILITATOR_URL` | Facilitator origin (no trailing path required in most SDKs) |
| `PR402_PAYER_KEYPAIR_JSON` | Absolute path to payer keypair (MCP) |
| `SOLANA_RPC_URL` | Optional override (prefer facilitator health RPC) |

## Forge MCP (marketplace — separate from pr402 HTTP pay)

Digital goods on [http402.trade](https://http402.trade):

```bash
npx -y @http402/forge-mcp
```

Example config: `x402-buyer-starter/examples/mcp/forge-cursor-mcp.json`

Tools: `forge_list`, `forge_preview`, `forge_purchase`

See [forge-marketplace.md](forge-marketplace.md).
