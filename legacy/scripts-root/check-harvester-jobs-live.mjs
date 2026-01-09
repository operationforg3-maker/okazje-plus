#!/usr/bin/env node
/**
 * Sprawdza produkcyjny endpoint /api/admin/harvester-jobs z autoryzacją admina
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Inicjalizacja Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, '..', 'serviceAccountKey.json'), 'utf8')
);

initializeApp({
  credential: cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyBk-qFQwDIlsHSnhugoQSN7abcoMX3mTl4';
const SIGN_IN_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`;
const ENDPOINTS = [
  'https://okazjeplus.pl/api/admin/harvester-jobs?limit=5',
];

async function fetchWithAuth(idToken) {
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Accept': 'application/json'
        }
      });
      if (!res.ok) {
        const text = await res.text();
        console.error(`❌ ${url} → HTTP ${res.status}`);
        console.error(text);
        continue;
      }
      const data = await res.json();
      console.log(`✅ ${url} → OK`);
      console.log(JSON.stringify(data, null, 2));
      return true;
    } catch (e) {
      console.error(`⚠️ Błąd przy ${url}:`, e.message);
    }
  }
  return false;
}

async function main() {
  try {
    const auth = getAuth();
    const adminUid = '8UsI6ihFDbarziFMJpJ2O5XwvTb2';

    console.log('🔐 Generuję custom token...');
    const customToken = await auth.createCustomToken(adminUid);

    console.log('🔄 Wymieniam na ID token...');
    const signInResponse = await fetch(SIGN_IN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true })
    });
    const signInData = await signInResponse.json();
    if (!signInData.idToken) {
      console.error('❌ Brak idToken w odpowiedzi:', signInData);
      process.exit(1);
    }

    console.log('🌐 Wołam endpoint produkcyjny...');
    const ok = await fetchWithAuth(signInData.idToken);
    process.exit(ok ? 0 : 2);
  } catch (error) {
    console.error('❌ Błąd krytyczny:', error);
    process.exit(1);
  }
}

main();
