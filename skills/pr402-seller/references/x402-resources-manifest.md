# x402-resources.json (Seller Resource Manifest)

Publishes **discoverable payable endpoints** to the pr402 facilitator index. Optional for accepting payments; required for **`GET /api/v1/facilitator/resources`** search.

## Typical location

Host at:

```
https://your-api.example.com/.well-known/x402-resources.json
```

Or any stable HTTPS URL referenced during enroll.

## Minimal shape

```json
{
  "schema": "x402/v1",
  "merchantWallet": "<seller_pubkey_base58>",
  "serviceUrl": "https://your-api.example.com",
  "resources": [
    {
      "resourceUrl": "https://your-api.example.com/api/premium",
      "method": "GET",
      "description": "Premium JSON endpoint",
      "mimeType": "application/json",
      "scheme": "exact",
      "amount": "50000",
      "asset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
    }
  ]
}
```

Adjust `asset` mint to match your rail (USDC mainnet mint shown; Devnet USDC differs — read from `GET /capabilities` or seller preview).

## Enroll safely

Use the action-scoped REST loop in [onboarding-cli.md](onboarding-cli.md): request and sign a fresh `resource:register` challenge for each resource, then a fresh `resource:probe` challenge for each optional probe. Never reuse a challenge.

`x402-cli enroll` and `tools/enroll.mjs` follow that rule.

## Origin binding rules

- `merchantWallet` must be **Activated** on-chain
- Each `resourceUrl` host must match the registered merchant **`serviceUrl`** origin
- Registration and optional live **probe** each require their own one-time challenge

## Probe behavior

- Facilitator probes allow public HTTP(S) only: no credentials, private/special addresses, redirects, or proxy use.
- The 402 response body must be valid UTF-8 JSON and at most 64 KiB.
- Automated discovery re-probes only `GET` resources. POST/PUT/PATCH/DELETE resources retain the seller-authorized manual probe result so the indexer never replays a mutating method.

## Discovery for buyers

After enroll + listing opt-in, buyer agents search:

```
GET /api/v1/facilitator/resources?q=<tags>
```

Not `GET /providers` for resource search — see [miralandlabs/pr402 DISCOVERY.md](https://github.com/miralandlabs/pr402/blob/main/docs/DISCOVERY.md).

## Subscription routes

Recurring access patterns map to multiple resource URLs on the **`exact`** rail — see [SUBSCRIPTION_PATTERN.md](https://github.com/miraland-labs/x402/blob/main/SUBSCRIPTION_PATTERN.md) in the x402 hub repo.
