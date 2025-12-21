#!/usr/bin/env node
/**
 * Uruchamia testy live przez produkcyjny endpoint /api/admin/tests/run z autoryzacją admina
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
const TESTS_URL = 'https://okazjeplus.pl/api/admin/tests/run';

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

    console.log('🧪 Uruchamiam testy live...');
    const response = await fetch(TESTS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${signInData.idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ preferAnonymous: true })
    });

    const result = await response.json();
    if (!response.ok) {
      console.error(`❌ HTTP ${response.status}`);
      console.error(result);
      process.exit(2);
    }

    console.log('✅ Wynik testów live:');
    console.log(JSON.stringify(result, null, 2));

    const data = result.data || {};
    console.log('\n📊 Podsumowanie:');
    console.log(`- Razem testów: ${data.totalTests ?? 'N/A'}`);
    console.log(`- Zaliczonych: ${data.passed ?? 'N/A'}`);
    console.log(`- Nieudanych: ${data.failed ?? 'N/A'}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Błąd krytyczny:', error);
    process.exit(1);
  }
}

main();
