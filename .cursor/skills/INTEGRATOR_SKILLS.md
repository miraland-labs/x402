# x402 Agent Skills (pr402 integrator)

Procedural skills for AI coding agents integrating with **pr402** on Solana — monetizing APIs as a seller or paying for resources as a buyer agent.

**Public install surface:** dedicated repo **[miraland-labs/x402-agent-skills](https://github.com/miraland-labs/x402-agent-skills)** (`pr402`, `pr402-seller`, `pr402-buyer`). A copy also lives under [`skills/`](../../skills/) in this hub for local sync; dev-only protocol skills remain under `.cursor/skills/`.

The x402 hub is **virtual** (coordination + x402-cli docs) — each codebase has its **own GitHub repository** (see table below).

Install with the [skills CLI](https://github.com/vercel-labs/skills):

```bash
npx skills add miraland-labs/x402-agent-skills --skill pr402 -y
npx skills add miraland-labs/x402-agent-skills --skill pr402-seller -y
npx skills add miraland-labs/x402-agent-skills --skill pr402-buyer -y
```

Legacy (hub copy — prefer `x402-agent-skills` above):

```bash
npx skills add miraland-labs/x402 --skill pr402-seller -y
npx skills add miraland-labs/x402 --skill pr402-buyer -y
```

List integrator skills:

```bash
npx skills add miraland-labs/x402-agent-skills --list
```

After install, skills appear in your agent's skill directory (e.g. `.cursor/skills/`). Install telemetry may list them on [skills.sh](https://www.skills.sh/) under grouped **Integrator** sections (`skills.sh.json` at repo root).

## Integrator skills

| Skill | Path | Audience | Starter repo (separate GitHub) |
| --- | --- | --- | --- |
| `pr402` | `skills/pr402/` | Entry / router — orient, pick seller vs buyer | — |
| `pr402-seller` | `skills/pr402-seller/` | x402 resource providers monetizing HTTP APIs via pr402 | [miraland-labs/x402-seller-starter](https://github.com/miraland-labs/x402-seller-starter) |
| `pr402-buyer` | `skills/pr402-buyer/` | x402 buyer agents, MCP hosts, autonomous payers via pr402 | [miraland-labs/x402-buyer-starter](https://github.com/miraland-labs/x402-buyer-starter) |

Local Cursor dev uses symlinks from `.cursor/skills/pr402*` → `skills/pr402*` so edits stay in one place.

## GitHub org map

| Owner | Repos |
| --- | --- |
| **`miraland-labs`** (organization) | `x402`, `x402-seller-starter`, `x402-buyer-starter`, `oracles`, `sla-escrow`, … |
| **`miralandlabs`** (individual) | **`pr402`** (facilitator, OpenAPI, MCP source) |

Do not link `pr402` under `miraland-labs` — use [github.com/miralandlabs/pr402](https://github.com/miralandlabs/pr402).

## Related skills (protocol developers)

- `pr402-facilitator` — edit the Rust facilitator ([miralandlabs/pr402](https://github.com/miralandlabs/pr402))
- `x402-ecosystem-hub` — navigate the virtual hub layout
- `universalsettle-chain` / `sla-escrow-chain` — on-chain program work

## Live docs (production default)

| Doc | URL |
| --- | --- |
| Agent runbook | [ipay.sh/agent-integration.md](https://ipay.sh/agent-integration.md) |
| Seller quickstart | [ipay.sh/quickstart-seller.md](https://ipay.sh/quickstart-seller.md) |
| Buyer starter | [github.com/miraland-labs/x402-buyer-starter](https://github.com/miraland-labs/x402-buyer-starter) |
| OpenAPI | [ipay.sh/openapi.json](https://ipay.sh/openapi.json) |
| MCP tool catalog | [ipay.sh/agent-tools.json](https://ipay.sh/agent-tools.json) |

**Facilitator base:** `https://ipay.sh` (Mainnet). Devnet testing: `https://preview.ipay.sh`.

**Pre-launch review:** [SKILLS_REVIEW_GUIDELINE.md](SKILLS_REVIEW_GUIDELINE.md) — fresh-eyes checklist before listing on skills.sh.

Apache-2.0 · [Miraland Labs](https://github.com/miraland-labs)
