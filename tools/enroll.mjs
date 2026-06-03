#!/usr/bin/env node
// Enroll a service's payable resources into the pr402 Layer-3 discovery directory.
//
// Reads a Seller Resource Manifest (x402-resources.json) and, for each resource,
// runs the wallet-signed flow: challenge -> sign -> register -> probe.
//
// Zero dependencies: Node 18+ (global fetch) + built-in crypto (ed25519).
//
// Usage:
//   node tools/enroll.mjs \
//     --manifest solrisk/public/.well-known/x402-resources.json \
//     --wallet <MERCHANT_PUBKEY_BASE58> \
//     --keypair /path/to/merchant-keypair.json \
//     [--facilitator https://ipay.sh/api/v1/facilitator] \
//     [--no-listing] [--no-probe] [--dry-run]
//
// Notes:
// - --keypair is a Solana keypair JSON (array of 64 bytes, or 32-byte seed).
// - --wallet must be the merchant pubkey that is already onboarded (Layer 2) and
//   whose serviceUrl host matches each resourceUrl host (origin binding).
// - Defaults: facilitator = https://ipay.sh/api/v1/facilitator, listingOptIn = true, probe = on.

import { readFileSync } from "node:fs";
import { createPrivateKey, sign as edSign } from "node:crypto";

function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : true; // bare flag -> true
}

const manifestPath = arg("manifest");
const keypairPath = arg("keypair");
const facilitator = (arg("facilitator", "https://ipay.sh/api/v1/facilitator")).replace(/\/$/, "");
const listingOptIn = arg("no-listing") !== true;
const doProbe = arg("no-probe") !== true;
const dryRun = arg("dry-run") === true;

if (!manifestPath || !keypairPath) {
  console.error("Required: --manifest <path> --keypair <path>  (see header for usage)");
  process.exit(2);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
let wallet = arg("wallet");
if (!wallet || wallet === true) {
  const mw = manifest.merchantWallet;
  if (mw && !/^REPLACE/i.test(mw)) wallet = mw;
}
if (!wallet || wallet === true) {
  console.error("Required: --wallet <merchant pubkey> (manifest.merchantWallet is a placeholder)");
  process.exit(2);
}

// Ed25519 private key from a Solana keypair file (first 32 bytes = seed).
function loadSigner(path) {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const bytes = Uint8Array.from(raw);
  const seed = Buffer.from(bytes.slice(0, 32));
  if (seed.length !== 32) throw new Error("keypair must contain at least 32 bytes");
  const pkcs8 = Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), seed]);
  return createPrivateKey({ key: pkcs8, format: "der", type: "pkcs8" });
}
const signer = loadSigner(keypairPath);
const signB64 = (msg) => edSign(null, Buffer.from(msg, "utf8"), signer).toString("base64");

async function getChallenge() {
  const r = await fetch(`${facilitator}/resources/register/challenge?wallet=${encodeURIComponent(wallet)}`);
  const j = await r.json();
  if (!r.ok || !j.message) throw new Error(`challenge failed (${r.status}): ${JSON.stringify(j)}`);
  return j.message;
}

async function postJson(path, body) {
  const r = await fetch(`${facilitator}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let j;
  try { j = JSON.parse(text); } catch { j = { raw: text }; }
  return { ok: r.ok, status: r.status, body: j };
}

function toRegisterPayload(res) {
  return {
    resourceUrl: res.resourceUrl,
    httpMethod: res.method || "GET",
    sellerResourceId: res.id,
    title: res.title,
    description: res.description,
    useCase: res.useCase,
    category: res.category,
    tags: res.tags,
    scheme: res.scheme,
    network: res.network,
    intentContractUrl: res.intentContractUrl,
    listingOptIn,
  };
}

const resources = manifest.resources || [];
console.log(`facilitator: ${facilitator}`);
console.log(`wallet:      ${wallet}`);
console.log(`manifest:    ${manifestPath} (${resources.length} resource(s))`);
console.log(`listingOptIn=${listingOptIn} probe=${doProbe} dryRun=${dryRun}\n`);

if (dryRun) {
  for (const res of resources) console.log("would register:", JSON.stringify(toRegisterPayload(res)));
  process.exit(0);
}

// One signed challenge authorizes every call below until it expires (no nonce burn).
const message = await getChallenge();
const signature = signB64(message);

let failures = 0;
for (const res of resources) {
  const label = res.id || res.resourceUrl;
  const reg = await postJson("/resources/register", {
    wallet, message, signature, source: "register_api", resource: toRegisterPayload(res),
  });
  if (!reg.ok) {
    failures++;
    console.error(`✗ register ${label}: ${reg.status} ${JSON.stringify(reg.body)}`);
    continue;
  }
  console.log(`✓ register ${label}: id=${reg.body.id}`);

  if (doProbe) {
    const probe = await postJson("/resources/probe", {
      wallet, message, signature, resourceUrl: res.resourceUrl,
    });
    if (probe.ok && probe.body.ok) {
      console.log(`  ✓ probe: httpStatus=${probe.body.httpStatus} (now eligible for public listing)`);
    } else {
      failures++;
      console.error(`  ✗ probe ${label}: ${probe.status} ${JSON.stringify(probe.body)}`);
    }
  }
}

console.log(failures ? `\nDone with ${failures} failure(s).` : "\nDone.");
process.exit(failures ? 1 : 0);
