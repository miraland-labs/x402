# Fresh-eyes review guideline — pr402 integrator skills

Use this checklist before listing **`pr402-seller`** and **`pr402-buyer`** on [skills.sh](https://www.skills.sh/).

**Review scope (read these files):**

| Skill | Main | References |
| --- | --- | --- |
| Seller | `skills/pr402-seller/SKILL.md` | `references/onboarding-cli.md`, `runtime-sdk.md`, `x402-resources-manifest.md` |
| Buyer | `skills/pr402-buyer/SKILL.md` | `references/exact-payment-flow.md`, `mcp-and-sdk.md`, `forge-marketplace.md` |
| Install guide | `.cursor/skills/INTEGRATOR_SKILLS.md` | — |

**Out of scope unless the reviewer is a protocol engineer:** dev-only skills (`pr402-facilitator`, `x402-ecosystem-hub`, chain skills).

---

## 1. Reviewer profile

Ideal reviewer:

- Has built or integrated a **REST API** (any language).
- Comfortable reading **HTTP headers**, env vars, and curl examples.
- **Not** the author of these skills and **not** deep in x402/pr402 already.
- Optional plus: has used Cursor/Claude with **MCP** or Agent Skills before.

Reviewer should **not** need a funded Mainnet wallet to complete the doc review. Optional smoke tests (Section 6) need Devnet or Mainnet keypairs.

---

## 2. Review goals

Answer one question: **If an agent loads this skill cold, will it guide a competent developer to a working integration without dangerous mistakes?**

Secondary goals:

- Production URLs and GitHub links are correct.
- Virtual-hub vs separate-repo layout is not confusing.
- Skill scope matches starter repos (exact rail first; escrow clearly deferred).
- Descriptions trigger on realistic user phrases.

---

## 3. Accuracy checklist

### 3.1 URLs and environments

- [ ] **Production defaults** use `https://ipay.sh` (not `preview.ipay.sh`) in examples, CLI `--facilitator`, MCP env, and Forge/facilitator exports.
- [ ] Preview/Devnet is mentioned **only** as an explicit testing alternative.
- [ ] Live doc links resolve (HTTP 200):  
  `https://ipay.sh/agent-integration.md`, `quickstart-seller.md`, `quickstart-buyer.md`, `openapi.json`, `agent-tools.json`.
- [ ] No broken or placeholder GitHub links.

### 3.2 GitHub org map (verify against each repo’s `origin`)

| Repo | Expected remote |
| --- | --- |
| pr402 facilitator | `github.com/miralandlabs/pr402` |
| x402 hub, starters, oracles, universalsettle | `github.com/miraland-labs/<repo>` |

- [ ] Skills never link **`miraland-labs/pr402`** (wrong org).
- [ ] Text states x402 hub is **virtual** — starters and pr402 are **separate clones**, not a monorepo.

### 3.3 Protocol facts (spot-check against [ipay.sh/agent-integration.md](https://ipay.sh/agent-integration.md))

**Seller skill**

- [ ] Onboarding order: preview → activate (provision-tx) → optional register → optional enroll → runtime SDK.
- [ ] `payTo` is a **PDA**, not the seller’s personal wallet.
- [ ] Headers: `PAYMENT-SIGNATURE` (in), `PAYMENT-RESPONSE` (out), 402 on unpaid.
- [ ] Starters target **`exact`** rail only; `sla-escrow` points to oracles docs.

**Buyer skill**

- [ ] Golden path: 402 → build-exact-payment-tx → sign → retry with `PAYMENT-SIGNATURE` → seller verify/settle → `PAYMENT-RESPONSE`. Direct buyer `/verify` + `/settle` only in advanced/CLI sections.
- [ ] Scheme normalization: `v2:solana:exact` → wire `exact` on build request.
- [ ] Distinguishes **Forge marketplace** vs generic HTTP 402 APIs.
- [ ] MCP (`@pr402/mcp-server`) vs SDK vs CLI paths are not conflated.

### 3.4 Internal consistency

- [ ] Seller and buyer skills agree on facilitator hosts and header names.
- [ ] Reference files do not contradict `SKILL.md`.
- [ ] Public integrator skills live under repo-root `skills/` (`pr402-seller`, `pr402-buyer` only); install docs require `--skill` when adding from the full hub.

---

## 4. Agent-skill quality checklist

### 4.1 Frontmatter

- [ ] `name` matches directory name (kebab-case).
- [ ] `description` states **what** and **when** (trigger keywords present).
- [ ] Description length ≤ 1024 characters.
- [ ] `metadata.author` / `metadata.version` present.

### 4.2 Progressive disclosure

- [ ] `SKILL.md` body is scannable (< ~500 lines each).
- [ ] Deep detail lives in `references/` with clear pointers from the main file.
- [ ] Reference links use relative paths that work after `npx skills add` install.

### 4.3 Scope discipline

- [ ] Skill does not instruct editing pr402 Rust source (that belongs in `pr402-facilitator`).
- [ ] Skill does not promise moderation, legal compliance, or region-specific OpenAI/DeepSeek features.
- [ ] No committed secrets, keypair JSON, or real private keys in examples.

### 4.4 Tone and usability

- [ ] Imperative steps (“Clone…”, “Set…”, “Call…”).
- [ ] A new reader can pick **seller** vs **buyer** skill from the title/description alone.
- [ ] Jargon (`SplitVault`, `enrich`, `verifyBodyTemplate`) is introduced in context or linked to live docs.

---

## 5. Competitive sanity check (optional, 15 min)

Search skills.sh for existing x402 skills:

```bash
npx skills find x402
npx skills find payment
```

- [ ] Reviewer notes how **our** skills differ from Coinbase/OKX/generic x402 skills (Solana + pr402 + Miraland starters + Forge).
- [ ] No accidental duplication of another skill’s name/slug on skills.sh.

---

## 6. Smoke tests (optional but recommended)

### 6.1 Install

```bash
npx skills add miraland-labs/x402 --skill pr402-seller -y
npx skills add miraland-labs/x402 --skill pr402-buyer -y
```

- [ ] CLI discovers both skills from the repo.
- [ ] Installed files land in the agent’s skills directory with intact `references/`.

### 6.2 Agent prompts (run in Cursor or Claude Code with skills enabled)

| # | Prompt | Expected behavior |
| --- | --- | --- |
| 1 | “I want to charge 0.05 USDC per API call on my Express app.” | Loads **seller** skill; mentions X402SellerSDK, ipay.sh, onboarding. |
| 2 | “Build a buyer agent that pays for x402 APIs with MCP.” | Loads **buyer** skill; mentions `@pr402/mcp-server`, `PR402_FACILITATOR_URL`. |
| 3 | “Add HTTP 402 to my FastAPI route.” | Seller skill; points to python starter, not hand-rolled PDA math. |
| 4 | “My agent got 402 — what header do I send back?” | Buyer skill; `PAYMENT-SIGNATURE`, build-exact-payment-tx flow. |
| 5 | “I need sla-escrow with an oracle.” | Skill **defers** to oracles docs; does not pretend starter covers it. |

- [ ] Agent cites production facilitator URL unless user asked for Devnet.
- [ ] Agent clones/links **separate** starter repos, not “edit x402 monorepo”.

---

## 7. Severity rubric

| Severity | Definition | Blocks public launch? |
| --- | --- | --- |
| **P0** | Wrong org URL for pr402, preview URL as default, unsafe secret handling, incorrect payment flow that loses funds | **Yes** |
| **P1** | Missing onboarding step, wrong header name, broken live doc link, misleading monorepo implication | **Yes** |
| **P2** | Unclear wording, missing trigger keyword, minor redundancy | Fix before or soon after launch |
| **P3** | Style, optional cross-links, nits | No |

---

## 8. Review deliverable template

Ask the reviewer to return:

```markdown
## Summary
(one paragraph: ship / ship with fixes / do not ship)

## P0 / P1 issues
- [file:line or section] issue → suggested fix

## P2 / P3 notes
- …

## Smoke tests
- [ ] Install OK
- [ ] Prompts 1–5 (pass/fail notes)

## Sign-off
- [ ] I would install these skills for a production integrator (yes/no)
- Reviewer:
- Date:
```

---

## 9. Pre-launch owner checklist (after review)

- [ ] All P0/P1 items resolved.
- [ ] Hub README + `INTEGRATOR_SKILLS.md` match final skill content.
- [ ] Root `skills.sh.json` groups integrator skills on skills.sh (verify after first install).
- [ ] Run `npx skills add miraland-labs/x402 --skill pr402-seller -y` from a clean machine to seed skills.sh telemetry.
- [ ] Link install commands from [miralandlabs/pr402](https://github.com/miralandlabs/pr402) docs and starter READMEs.

---

## 10. Reference links for reviewers

- Skills spec: [agentskills.io/specification](https://agentskills.io/specification)
- skills.sh customize (repo groupings): [skills.sh/docs/customize](https://www.skills.sh/docs/customize)
- Live pr402 runbook: [ipay.sh/agent-integration.md](https://ipay.sh/agent-integration.md)
- Seller starter: [github.com/miraland-labs/x402-seller-starter](https://github.com/miraland-labs/x402-seller-starter)
- Buyer starter: [github.com/miraland-labs/x402-buyer-starter](https://github.com/miraland-labs/x402-buyer-starter)
