import 'dotenv/config';
import { Keypair } from '@solana/web3.js';
import { FifaWorldCupClient } from './client.js';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const keypairPath = process.env.BUYER_KEYPAIR_PATH || './buyer-keypair.json';
const endpointBaseUrl = process.env.API_BASE_URL || 'https://fifa.polystrike.io/devnet';

async function runTests() {
  console.log('🧪 Starting FIFA World Cup Scraper API Integration Tests');
  console.log('='.repeat(65));
  console.log(`Target Host: ${endpointBaseUrl}\n`);

  // ── 0. Check Buyer Keypair ──────────────────────────────────────────────────
  if (!fs.existsSync(keypairPath)) {
    console.log(`ℹ️ No keypair found at ${keypairPath}. Creating a temporary keypair for testing...`);
    const tempKeypair = Keypair.generate();
    fs.writeFileSync(keypairPath, JSON.stringify(Array.from(tempKeypair.secretKey)));
    console.log(`✅ Temporary keypair created at ${keypairPath}.`);
    console.log(`   Public Key: ${tempKeypair.publicKey.toBase58()}`);
    console.log(`⚠️  Note: This new wallet has 0 devnet SOL/USDC. x402 payment tests will skip unless funded.`);
  }

  const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, 'utf8')));
  const buyerKeypair = Keypair.fromSecretKey(secretKey);
  
  const client = new FifaWorldCupClient({
    payerKeypair: buyerKeypair,
    endpointBaseUrl,
    defaultFacilitatorUrl: process.env.FACILITATOR_BASE_URL || 'https://preview.ipay.sh',
  });

  // ── Test 1: Health & Discovery Info (Free Endpoints) ────────────────────────
  console.log('\n📡 Test 1: Health Check & Subscription Info (Free)...');
  try {
    const health = await axios.get(`${endpointBaseUrl}/health`);
    console.log('   [PASS] Health check returned 200 OK:', health.data);
  } catch (err: any) {
    console.log('   [FAIL] Health check failed:', err.message);
  }

  try {
    const info = await axios.get(`${endpointBaseUrl}/api/v1/subscribe/info`);
    console.log('   [PASS] Info endpoint returned 200 OK. Available Tiers:');
    for (const tier of info.data.tiers) {
      console.log(`          - ${tier.tier} (${tier.label})`);
    }
  } catch (err: any) {
    console.log('   [FAIL] Info endpoint failed:', err.message);
  }

  // ── Test 2: Access Control Verification ────────────────────────────────────
  console.log('\n🔒 Test 2: Access Control Verification...');
  try {
    await axios.post(`${endpointBaseUrl}/api/v1/odds`, {
      targetUrl: 'https://www.fifa.com/en/news'
    });
    console.log('   [FAIL] Expected 401 for unauthorized endpoint call but it succeeded.');
  } catch (err: any) {
    if (err.response && err.response.status === 401) {
      console.log(`   [PASS] Calling paid endpoint without token correctly returned 401 (${err.response.data.error})`);
    } else {
      console.log('   [FAIL] Unexpected error during unauthorized call:', err.message);
    }
  }

  try {
    await axios.post(`${endpointBaseUrl}/api/v1/odds`, {
      targetUrl: 'https://www.fifa.com/en/news'
    }, {
      headers: { Authorization: 'Bearer invalid-token-value' }
    });
    console.log('   [FAIL] Expected 401 for invalid token but it succeeded.');
  } catch (err: any) {
    if (err.response && err.response.status === 401) {
      console.log(`   [PASS] Calling with invalid token correctly returned 401 (${err.response.data.error})`);
    } else {
      console.log('   [FAIL] Unexpected error during invalid token call:', err.message);
    }
  }

  // ── Test 3: Subscription & Payment Flow (x402) ──────────────────────────────
  console.log('\n💳 Test 3: Subscription & Payment Flow (x402)...');
  let tokenAcquired = false;
  try {
    console.log('   Initiating hourly subscription purchase transaction...');
    const sub = await client.subscribe('hourly');
    console.log('   [PASS] Subscription purchased successfully!');
    console.log(`          Token: ${sub.token.slice(0, 30)}...`);
    console.log(`          Expires: ${sub.expiresAt.toISOString()}`);
    tokenAcquired = true;
  } catch (err: any) {
    console.log('   [SKIP/FAIL] Could not purchase subscription:', err.message);
    console.log('               Ensure your test wallet has devnet SOL and test USDC.');
    console.log(`               Wallet Address: ${buyerKeypair.publicKey.toBase58()}`);
  }

  if (!tokenAcquired) {
    console.log('\n⚠️  Remaining integration tests skipped because no valid subscription token could be acquired.');
    console.log('='.repeat(65));
    return;
  }

  // ── Test 4: Content Retrieval & Cache Verification ──────────────────────────
  console.log('\n📦 Test 4: Content Retrieval & Cache Verification...');
  const testUrl = 'https://www.fifa.com/en/news/cache-test-dummy';
  
  try {
    console.log('   Request 1 (Uncached): Fetching odds...');
    const start1 = Date.now();
    const res1 = await client.getOdds(testUrl);
    const duration1 = Date.now() - start1;
    console.log(`   [PASS] Request 1 completed in ${duration1}ms. Items returned: ${res1.length}`);

    console.log('   Request 2 (Cached): Fetching same odds URL...');
    const start2 = Date.now();
    const res2 = await client.getOdds(testUrl);
    const duration2 = Date.now() - start2;
    console.log(`   [PASS] Request 2 completed in ${duration2}ms (Cache Hit). Items returned: ${res2.length}`);
    
    if (duration2 < duration1 / 2) {
      console.log(`   [PASS] Cache hit is verified (Uncached: ${duration1}ms vs Cached: ${duration2}ms)`);
    } else {
      console.log(`   [WARN] Cache hit response time (${duration2}ms) was not significantly faster than first call.`);
    }
  } catch (err: any) {
    console.log('   [FAIL] Content retrieval failed:', err.message);
  }

  // ── Test 5: Rate Limiting Verification ──────────────────────────────────────
  console.log('\n⚡ Test 5: Rate Limiting Verification...');
  console.log('   Sending rapid concurrent requests to trigger the 60 req/min rate limit...');
  
  const requests = Array.from({ length: 65 }).map((_, i) => {
    return client.getOdds(`${testUrl}-rate-limit-${i}`).catch(err => err);
  });

  const results = await Promise.all(requests);
  const failures = results.filter(res => res instanceof Error);
  const rateLimitHits = failures.filter(err => err.message.includes('429') || err.message.includes('RATE_LIMIT') || err.message.includes('SUBSCRIBER_RATE_LIMIT_EXCEEDED'));

  if (rateLimitHits.length > 0) {
    console.log(`   [PASS] Successfully triggered and caught ${rateLimitHits.length} rate limit hits (HTTP 429).`);
    const sampleErr = rateLimitHits[0] as Error;
    console.log('          Sample Rate Limit Error Message:', sampleErr.message);
  } else {
    console.log('   [FAIL] Sent 65 requests but no HTTP 429 Rate Limit responses were triggered.');
  }

  console.log('\n' + '='.repeat(65));
  console.log('🎉 Integration tests complete!');
}

runTests().catch(console.error);
