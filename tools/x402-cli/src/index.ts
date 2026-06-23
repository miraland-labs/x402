#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { createPrivateKey, sign as edSign } from "node:crypto";
import { resolve } from "node:path";

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function encodeBase58(buffer: Buffer | Uint8Array): string {
  let num = BigInt(0);
  for (const byte of buffer) {
    num = (num << 8n) + BigInt(byte);
  }
  let encoded = "";
  while (num > 0n) {
    const rem = num % 58n;
    encoded = ALPHABET[Number(rem)] + encoded;
    num = num / 58n;
  }
  // Add leading zeros
  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i] === 0) {
      encoded = "1" + encoded;
    } else {
      break;
    }
  }
  return encoded;
}

function loadSigner(keypairPath: string): { privateKey: any; publicKey: string } {
  try {
    const raw = JSON.parse(readFileSync(resolve(keypairPath), "utf8"));
    const bytes = Uint8Array.from(raw);
    if (bytes.length < 64) {
      throw new Error("Solana keypair must contain at least 64 bytes");
    }
    const seed = Buffer.from(bytes.slice(0, 32));
    const pubkeyBytes = bytes.slice(32, 64);
    const publicKey = encodeBase58(pubkeyBytes);

    // Construct PKCS#8 DER header for raw Ed25519 seed
    const pkcs8 = Buffer.concat([
      Buffer.from("302e020100300506032b657004220420", "hex"),
      seed
    ]);
    const privateKey = createPrivateKey({ key: pkcs8, format: "der", type: "pkcs8" });
    return { privateKey, publicKey };
  } catch (e: any) {
    throw new Error(`Failed to load keypair from ${keypairPath}: ${e.message}`);
  }
}

function getArg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const val = process.argv[index + 1];
  if (val && !val.startsWith("--")) return val;
  return "true"; // binary flag
}

async function fetchJson(url: string, options: any = {}) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(options.headers || {})
  };
  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { error: text };
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(json.error || json)}`);
  }
  return json;
}

function printUsage() {
  console.log(`
x402-cli: Unified Developer CLI Tool for X402 Onboarding & Discovery

Usage:
  npx x402-cli <command> [options]

Commands:
  status     Inspect onboarding lifecycle status of a wallet.
  activate   Obtain transaction data to provision SplitVault on-chain.
  register   Register your merchant wallet & metadata in the off-chain directory.
  enrich     Create/enrich a PaymentRequired 402 challenge dynamically.
  enroll     Enroll resource endpoints from an x402-resources.json manifest.

General Options:
  --facilitator <url>   Facilitator origin or full API URL (Default: https://preview.ipay.sh)
                        Accepts both origin and /api/v1/facilitator-suffixed forms.
  --wallet <address>    Solana Wallet address (derived if keypair is provided)
  --keypair <path>      Path to Solana keypair JSON file

For Command 'status':
  x402-cli status [--wallet <addr>] [--keypair <path>]

For Command 'activate':
  x402-cli activate [--wallet <addr>] [--keypair <path>] [--asset SOL|USDC|mint]

For Command 'register':
  x402-cli register --keypair <path> [--url <shop_url>] [--display-name <name>] [--description <desc>] [--tags <tags>]

For Command 'enrich':
  x402-cli enrich [--wallet <addr>] [--keypair <path>] --amount <amount> --url <api_url> [--scheme exact|sla-escrow] [--asset mint] [--out <file>]

For Command 'enroll':
  x402-cli enroll --manifest <path> --keypair <path> [--no-listing] [--no-probe]
`);
}

async function main() {
  const command = process.argv[2];
  if (!command || command === "--help" || command === "-h") {
    printUsage();
    process.exit(0);
  }

  const API_PREFIX = "/api/v1/facilitator";
  const rawFacilitator = (getArg("facilitator") || "https://preview.ipay.sh").replace(/\/+$/, "");
  const facilitator = rawFacilitator.includes(API_PREFIX)
    ? rawFacilitator
    : `${rawFacilitator}${API_PREFIX}`;

  let wallet = getArg("wallet");
  const keypairPath = getArg("keypair");
  let signer: { privateKey: any; publicKey: string } | null = null;

  if (keypairPath && keypairPath !== "true") {
    signer = loadSigner(keypairPath);
    if (!wallet || wallet === "true") {
      wallet = signer.publicKey;
    }
  }

  try {
    switch (command) {
      case "status": {
        if (!wallet || wallet === "true") {
          throw new Error("Required: --wallet <address> or --keypair <path>");
        }
        console.log(`Checking status for wallet: ${wallet}`);
        console.log(`Facilitator URL:            ${facilitator}\n`);

        const preview = await fetchJson(`${facilitator}/sellers/${wallet}/preview`);
        const exactInfo = preview.schemes?.exact;
        const escrowInfo = preview.schemes?.["sla-escrow"];
        const lifecycle = preview.lifecycle || {};

        console.log("═════════════════════════════════════════════════");
        console.log("             X402 LIFECYCLE STATUS               ");
        console.log("═════════════════════════════════════════════════");
        console.log(`[${lifecycle.previewed ? "✓" : " "}] Previewed  : PDAs derived successfully`);
        console.log(`[${lifecycle.activated ? "✓" : " "}] Activated  : Vault exists on-chain`);
        console.log(`[${lifecycle.verified ? "✓" : " "}] Verified   : Registered in directory`);
        console.log("─────────────────────────────────────────────────");
        
        if (exactInfo) {
          console.log(`Exact Rail (SplitVault):`);
          console.log(`  Vault PDA:     ${exactInfo.vaultPda}`);
          console.log(`  Fee Rate:      ${(exactInfo.feeBps / 100).toFixed(2)}%`);
          console.log(`  Status:        ${exactInfo.status}`);
          console.log(`  Sovereign:     ${exactInfo.isSovereign ? "Yes (10 bps discount)" : "No"}`);
        }
        if (escrowInfo) {
          console.log(`Escrow Rail (SLA-Escrow):`);
          console.log(`  Bank Address:  ${escrowInfo.bankPda || "N/A"}`);
          console.log(`  Status:        ${escrowInfo.status}`);
        }
        console.log("─────────────────────────────────────────────────");
        if (lifecycle.nextStep) {
          console.log(`👉 Next Step: Run 'x402-cli ${lifecycle.nextStep}' or connect at preview.ipay.sh`);
        } else {
          console.log("🎉 All onboarding steps complete! Ready to receive payments.");
        }
        console.log("═════════════════════════════════════════════════");
        break;
      }

      case "activate": {
        if (!wallet || wallet === "true") {
          throw new Error("Required: --wallet <address> or --keypair <path>");
        }
        const asset = getArg("asset") || "USDC";
        console.log(`Requesting activation for:  ${wallet}`);
        console.log(`Asset:                      ${asset}`);
        console.log(`Facilitator URL:            ${facilitator}\n`);

        const res = await fetchJson(`${facilitator}/sellers/provision-tx`, {
          method: "POST",
          body: JSON.stringify({ wallet, asset })
        });

        if (res.alreadyProvisioned) {
          console.log(`✅ Vault is already activated for asset: ${asset}`);
        } else if (res.transaction) {
          console.log(`⚠️ Vault not yet activated.`);
          console.log(`Generated Solana transaction (base64 bincode):`);
          console.log(`\n${res.transaction}\n`);
          console.log(`Instructions:`);
          console.log(`  Please copy this transaction string and execute it via your wallet or developer CLI.`);
          console.log(`  Alternatively, connect your wallet to ${facilitator.replace("/api/v1/facilitator", "")} to activate in one click.`);
        }
        break;
      }

      case "register": {
        if (!signer) {
          throw new Error("Required: --keypair <path> to sign the registration challenge.");
        }
        const shopUrl = getArg("url");
        const displayName = getArg("display-name");
        const description = getArg("description");
        const tags = getArg("tags");
        
        console.log(`Registering wallet:    ${signer.publicKey}`);
        console.log(`Facilitator:           ${facilitator}\n`);

        // 1. Fetch challenge
        const challenge = await fetchJson(`${facilitator}/sellers/${signer.publicKey}/challenge`);
        const message = challenge.message;
        if (!message) {
          throw new Error("Failed to retrieve challenge message from facilitator");
        }

        // 2. Sign the challenge
        const signature = edSign(null, Buffer.from(message, "utf8"), signer.privateKey).toString("base64");

        // 3. Prepare discovery payload
        const discovery = shopUrl || displayName || description || tags ? {
          serviceUrl: shopUrl === "true" ? undefined : shopUrl,
          displayName: displayName === "true" ? undefined : displayName,
          description: description === "true" ? undefined : description,
          tags: tags && tags !== "true" ? tags.split(",").map(t => t.trim()) : undefined,
          listingOptIn: true
        } : undefined;

        // 4. Submit registration
        const regResult = await fetchJson(`${facilitator}/sellers/${signer.publicKey}/register`, {
          method: "POST",
          body: JSON.stringify({
            wallet: signer.publicKey,
            message,
            signature,
            asset: "USDC",
            discovery
          })
        });

        console.log(`✅ Registration successful!`);
        if (regResult.schemes?.exact) {
          console.log(`Vault PDA: ${regResult.schemes.exact.vaultPda}`);
        }
        break;
      }

      case "enrich": {
        if (!wallet || wallet === "true") {
          throw new Error("Required: --wallet <address> or --keypair <path>");
        }
        const amount = getArg("amount");
        const url = getArg("url");
        if (!amount || amount === "true" || !url || url === "true") {
          throw new Error("Required parameters: --amount <amount> --url <api_url>");
        }
        const scheme = getArg("scheme") || "exact";
        const out = getArg("out");

        console.log(`Enriching PaymentRequired...`);
        console.log(`Facilitator URL: ${facilitator}`);

        // Get capabilities to resolve default network & asset
        const caps = await fetchJson(`${facilitator}/capabilities`);
        const network = caps.solanaNetwork || caps.network || "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
        const asset = getArg("asset") || caps.usdcMint || "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

        const draft = {
          x402Version: 2,
          resource: { url },
          accepts: [
            {
              scheme,
              network,
              payTo: wallet,
              asset,
              amount,
              maxTimeoutSeconds: 300
            }
          ]
        };

        const enriched = await fetchJson(`${facilitator}/payment-required/enrich`, {
          method: "POST",
          body: JSON.stringify(draft)
        });

        const output = JSON.stringify(enriched, null, 2);
        if (out && out !== "true") {
          writeFileSync(resolve(out), output + "\n");
          console.log(`✅ Wrote enriched payment requirements to: ${out}`);
        } else {
          console.log("\nEnriched PaymentRequired Response:\n");
          console.log(output);
        }
        break;
      }

      case "enroll": {
        if (!signer) {
          throw new Error("Required: --keypair <path> to sign resource listings.");
        }
        const manifestPath = getArg("manifest");
        if (!manifestPath || manifestPath === "true") {
          throw new Error("Required: --manifest <path> to x402-resources.json");
        }

        const noListing = getArg("no-listing") === "true";
        const noProbe = getArg("no-probe") === "true";

        const manifest = JSON.parse(readFileSync(resolve(manifestPath), "utf8"));
        const resources = manifest.resources || [];

        console.log(`Enrolling resources for wallet: ${signer.publicKey}`);
        console.log(`Manifest:                      ${manifestPath} (${resources.length} resources)\n`);

        const challenge = await fetchJson(`${facilitator}/resources/register/challenge?wallet=${encodeURIComponent(signer.publicKey)}`);
        const message = challenge.message;
        if (!message) {
          throw new Error("Failed to fetch register challenge");
        }
        const signature = edSign(null, Buffer.from(message, "utf8"), signer.privateKey).toString("base64");

        let failures = 0;
        for (const res of resources) {
          const label = res.id || res.resourceUrl;
          const payload = {
            resourceUrl: res.resourceUrl,
            httpMethod: res.method || "GET",
            sellerResourceId: res.id,
            title: res.title,
            description: res.description,
            useCase: res.useCase,
            category: res.category,
            tags: res.tags,
            scheme: res.scheme || manifest.scheme || "exact",
            network: res.network || manifest.network || "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
            intentContractUrl: res.intentContractUrl,
            listingOptIn: !noListing
          };

          try {
            const reg = await fetchJson(`${facilitator}/resources/register`, {
              method: "POST",
              body: JSON.stringify({
                wallet: signer.publicKey,
                message,
                signature,
                source: "register_api",
                resource: payload
              })
            });
            console.log(`✓ register ${label}: id=${reg.id}`);

            if (!noProbe) {
              const probe = await fetchJson(`${facilitator}/resources/probe`, {
                method: "POST",
                body: JSON.stringify({
                  wallet: signer.publicKey,
                  message,
                  signature,
                  resourceUrl: res.resourceUrl
                })
              });
              if (probe.ok) {
                console.log(`  ✓ probe: httpStatus=${probe.httpStatus} (now eligible for public listing)`);
              } else {
                failures++;
                console.error(`  ✗ probe ${label} failed: ${JSON.stringify(probe)}`);
              }
            }
          } catch (e: any) {
            failures++;
            console.error(`✗ failed to register/probe ${label}: ${e.message}`);
          }
        }

        console.log(failures ? `\nDone with ${failures} failure(s).` : "\nDone.");
        process.exit(failures ? 1 : 0);
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }
  } catch (err: any) {
    console.error(`\n❌ Error: ${err.message}`);
    process.exit(1);
  }
}

main();
