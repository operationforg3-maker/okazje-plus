#!/usr/bin/env node
/**
 * Live M6 verification script:
 * - Obtain ID token (via custom token exchange) or use ID_TOKEN env
 * - POST /api/admin/harvester/run on production
 * - Fetch /api/admin/harvester-jobs to verify job presence
 *
 * Usage:
 *   BASE_URL=https://okazjeplus.pl node scripts/live-harvester-run.mjs
 *   ID_TOKEN=... BASE_URL=... node scripts/live-harvester-run.mjs
 *   ADMIN_UID=... BASE_URL=... node scripts/live-harvester-run.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');

const SERVICE_ACCOUNT_PATH = path.resolve(process.cwd(), 'serviceAccountKey.json');
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyBk-qFQwDIlsHSnhugoQSN7abcoMX3mTl4';
const BASE_URL = process.env.BASE_URL || 'https://okazjeplus.pl';
const ADMIN_UID = process.env.ADMIN_UID || '8UsI6ihFDbarziFMJpJ2O5XwvTb2';

async function getIdToken() {
  if (process.env.ID_TOKEN) return process.env.ID_TOKEN;
  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) throw new Error('Missing serviceAccountKey.json');
  const sa = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
  const customToken = await admin.auth().createCustomToken(ADMIN_UID);
  const resp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: customToken, returnSecureToken: true }) }
  );
  if (!resp.ok) throw new Error(`Token exchange failed: ${resp.status} ${await resp.text()}`);
  const data = await resp.json();
  return data.idToken;
}

async function postHarvester(idToken) {
  const body = {
    source: 'aliexpress',
    query: 'usb c kabel',
    maxResults: 10,
    mode: 'single'
  };
  const resp = await fetch(`${BASE_URL}/api/admin/harvester/run`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const text = await resp.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  console.log('[DEBUG] Harvester response body:', text.slice(0, 500));
  return { ok: resp.ok, status: resp.status, json };
}

async function getJobs(idToken) {
  const resp = await fetch(`${BASE_URL}/api/admin/harvester-jobs?limit=10`, {
    headers: { 'Authorization': `Bearer ${idToken}` }
  });
  const text = await resp.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { ok: resp.ok, status: resp.status, json };
}

async function main() {
  console.log(`[live-harvester-run] Base URL: ${BASE_URL}`);
  const start = Date.now();
  const idToken = await getIdToken();
  console.log('[live-harvester-run] Got ID token');

  console.log('[live-harvester-run] Fetching recent jobs...');
  const before = await getJobs(idToken);
  console.log(JSON.stringify({ step: 'jobs-before', status: before.status, total: before.json?.total }, null, 2));

  console.log('[live-harvester-run] Posting harvester run...');
  const run = await postHarvester(idToken);
  console.log(JSON.stringify({ step: 'run', status: run.status, ok: run.ok, job: run.json?.job }, null, 2));

  console.log('[live-harvester-run] Waiting 3s then fetching jobs...');
  await new Promise(r => setTimeout(r, 3000));
  const after = await getJobs(idToken);
  console.log(JSON.stringify({ step: 'jobs-after', status: after.status, total: after.json?.total }, null, 2));

  console.log('[live-harvester-run] Done in', `${Date.now() - start}ms`);
}

main().catch((e) => { console.error(e); process.exit(1); });
