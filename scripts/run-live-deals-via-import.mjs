#!/usr/bin/env node
/**
 * Uruchamia import deali przez endpoint Konsoli Import/Export (bez AI Tools)
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, '..', 'serviceAccountKey.json'), 'utf8')
);

initializeApp({
  credential: cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

async function getIdToken(adminUid) {
  const auth = getAuth();
  const customToken = await auth.createCustomToken(adminUid);

  const signInUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=AIzaSyBk-qFQwDIlsHSnhugoQSN7abcoMX3mTl4`;
  const res = await fetch(signInUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true })
  });
  const data = await res.json();
  if (!data.idToken) throw new Error('Nie udało się uzyskać ID tokena');
  return data.idToken;
}

async function run() {
  try {
    const adminUid = '8UsI6ihFDbarziFMJpJ2O5XwvTb2';
    const idToken = await getIdToken(adminUid);

    const response = await fetch('https://okazjeplus.pl/api/admin/import/start', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ type: 'deals', maxItemsPerSubcategory: 10, importerType: 'keyword-search' })
    });

    const text = await response.text();
    let json;
    try { json = JSON.parse(text); } catch { throw new Error(`Non-JSON response: ${text.substring(0,200)}`); }

    if (!response.ok || !json.success) {
      throw new Error(`API error: ${json.error || json.message || response.status}`);
    }

    console.log('✅ Import job queued:', json);

    // Czekamy na przetworzenie i sprawdzamy deale
    console.log('⏳ Czekam 2 minuty...');
    await new Promise(r => setTimeout(r, 120000));

    console.log('🔍 Sprawdzam wyniki deali...');
    const { spawn } = await import('child_process');
    await new Promise((resolve, reject) => {
      const p = spawn('node', ['scripts/check-deals.mjs'], { stdio: 'inherit' });
      p.on('close', code => code === 0 ? resolve(null) : reject(new Error('check-deals failed')));
    });
  } catch (e) {
    console.error('❌ Błąd:', e.message);
    process.exit(1);
  }
}

run();
