# http402 Forge marketplace (buyer)

Browse and purchase **digital listings** (PDFs, assets) from Forge — complementary to generic HTTP 402 APIs.

## npm packages

| Package | Role |
| --- | --- |
| `@http402/forge-cli` | CLI: list, buy, publish |
| `@http402/forge-client` | TypeScript SDK |
| `@http402/forge-mcp` | MCP tools for agents |

## CLI quick start

```bash
npm install -g @http402/forge-cli

# API base (REST endpoints) — not a browser homepage; GET / may 404 while /api routes work
export FORGE_API_BASE=https://forge.http402.trade
export FACILITATOR_BASE=https://ipay.sh
export FORGE_KEYPAIR=/path/to/buyer-keypair.json

forge list --pretty
forge buy <listing-uuid> --verify
```

Devnet preview stack: `FORGE_API_BASE=https://preview.forge.http402.trade`, `FACILITATOR_BASE=https://preview.ipay.sh`.

Seller publish (needs seller vault activated):

```bash
forge publish --asset ./file.pdf --title "My PDF" --price 0.05
```

## MCP (agents)

```bash
npx -y @http402/forge-mcp
```

Wire in `.cursor/mcp.json` — copy from [forge-cursor-mcp.json](https://github.com/miraland-labs/x402-buyer-starter/blob/main/examples/mcp/forge-cursor-mcp.json):

- `FORGE_API_BASE`
- `FACILITATOR_BASE` (pr402 facilitator for payment rail)
- `FORGE_KEYPAIR` or buyer secret env per example

**Tools:** `forge_list`, `forge_preview`, `forge_purchase`

## Local Forge API dev

```bash
FORGE_API_BASE=http://127.0.0.1:8092 \
FACILITATOR_BASE=https://ipay.sh/api/v1/facilitator \
BUYER_SECRET_KEY='[...]' \
npm run forge:buy -- {listing-uuid}
```

(Legacy script path in buyer-starter; prefer global `forge` CLI + npm packages.)

## Portal URLs (production default)

| Surface | Production | Notes |
| --- | --- | --- |
| Marketplace UI | https://http402.trade | Human browse/download portal |
| Forge API base | https://forge.http402.trade | Set `FORGE_API_BASE` to this host; use API paths (e.g. listings), not the site root |
| Facilitator | https://ipay.sh | pr402 payment rail |

Preview (Devnet): `preview.http402.trade`, `preview.forge.http402.trade`, `preview.ipay.sh`.

## Relationship to pr402 buyer flow

- **Forge purchase** — listing UUID, asset download, SplitVault seller on Forge
- **Generic 402 API** — arbitrary HTTP resource URL + `PAYMENT-SIGNATURE`

An agent may use **both** MCP servers (`pr402` + `forge`) in one project.

## Seller publishing to Forge

Requires activated seller vault (see **`pr402-seller`** skill). Forge CLI `publish` uploads to R2-backed listings — not the same as `x402-resources.json` enroll for REST APIs, though both use pr402 settlement.
