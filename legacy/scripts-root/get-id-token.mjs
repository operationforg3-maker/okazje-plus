#!/usr/bin/env node
/**
 * Generate Firebase ID token for production using a Custom Token + Identity Toolkit exchange.
 *
 * Requirements:
 * - serviceAccountKey.json in repo root (prod project credentials)
 * - Admin UID with admin role set in Firestore (users/{uid}.role == 'admin')
 *
 * Usage:
 *   node scripts/get-id-token.mjs [UID]
 *   ADMIN_UID=<uid> node scripts/get-id-token.mjs
 *
 * Prints JSON: { idToken, refreshToken, expiresIn, uid }
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const admin = require('firebase-admin');

const SERVICE_ACCOUNT_PATH = path.resolve(process.cwd(), 'serviceAccountKey.json');
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyBk-qFQwDIlsHSnhugoQSN7abcoMX3mTl4';

async function main() {
  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error('Missing serviceAccountKey.json in project root.');
    process.exit(1);
  }

  const sa = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  }

  const uid = process.argv[2] || process.env.ADMIN_UID || '8UsI6ihFDbarziFMJpJ2O5XwvTb2';

  const customToken = await admin.auth().createCustomToken(uid);

  const resp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  );

  if (!resp.ok) {
    const text = await resp.text();
    console.error('Token exchange failed:', resp.status, text);
    process.exit(2);
  }

  const data = await resp.json();
  const out = {
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    expiresIn: data.expiresIn,
    uid,
  };
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
