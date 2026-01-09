#!/usr/bin/env node
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { execSync } from 'child_process';
import fs from 'fs';

/**
 * Live Refiner Test Script
 * 
 * Uruchamia Refiner na pending_approval ProductCores na produkcji
 * 
 * Wymaga: ADMIN_UID, BASE_URL env vars
 * 
 * Kroki:
 * 1. Wygeneruj ID token dla admina (serviceAccountKey.json)
 * 2. POST /api/admin/refiner/run
 * 3. Pobierz status job'a
 */

const ADMIN_UID = process.env.ADMIN_UID || '8UsI6ihFDbarziFMJpJ2O5XwvTb2';
const BASE_URL = process.env.BASE_URL || 'https://okazjeplus.pl';

console.log('🔧 Live Refiner Test');
console.log(`Admin UID: ${ADMIN_UID}`);
console.log(`Base URL: ${BASE_URL}`);
console.log('---');

// 1. Get ID token
console.log('📝 Step 1: Generate ID token...');
const getTokenCmd = `node scripts/get-id-token.mjs`;
const tokenOutput = execSync(getTokenCmd, { encoding: 'utf-8', cwd: process.cwd() });
const tokenData = JSON.parse(tokenOutput);
const idToken = tokenData.idToken;
console.log(`✅ Token generated: ${idToken.substring(0, 30)}...`);

// 2. Run refiner
console.log('\n🚀 Step 2: POST /api/admin/refiner/run...');
const refinerCmd = `curl -X POST ${BASE_URL}/api/admin/refiner/run \
  -H "Authorization: Bearer ${idToken}" \
  -H "Content-Type: application/json" \
  -d '{"limit": 10, "dryRun": false}' 2>/dev/null`;

const refinerOutput = execSync(refinerCmd, { encoding: 'utf-8' });
const refinerResult = JSON.parse(refinerOutput);

if (refinerResult.error) {
  console.error('❌ Error:', refinerResult.error);
  process.exit(1);
}

console.log('✅ Refiner job started');
const jobId = refinerResult.job?.id;
if (jobId) {
  console.log(`Job ID: ${jobId}`);
  console.log(`Status: ${refinerResult.job?.status}`);
  console.log(`Products found: ${refinerResult.job?.productsFound}`);
  console.log(`Products enriched: ${refinerResult.job?.productsEnriched}`);
  console.log(`Errors: ${refinerResult.job?.errors?.length || 0}`);

  if (refinerResult.job?.logs && refinerResult.job.logs.length > 0) {
    console.log('\n📋 Logs:');
    refinerResult.job.logs.slice(-5).forEach((log) => {
      console.log(`  [${log.status}] ${log.productId}: ${log.message}`);
    });
  }
}

console.log('\n✨ Refiner execution complete!');
console.log(JSON.stringify(refinerResult, null, 2));
