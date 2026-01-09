#!/usr/bin/env node
/**
 * Wywołuje import deali bezpośrednio na produkcji przez Firebase Admin SDK
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

console.log('🔐 Pobieranie custom tokena dla admina...\n');

// Znajdź admina w bazie
const auth = getAuth();

async function runImport() {
  try {
    // Użyj znanego UID admina lub znajdź pierwszego admina
    const adminUid = '8UsI6ihFDbarziFMJpJ2O5XwvTb2'; // Z poprzedniego tokena
    
    // Wygeneruj custom token
    const customToken = await auth.createCustomToken(adminUid);
    
    console.log('🚀 Wywołuję API produkcyjne...\n');
    
    // Najpierw zaloguj się przez custom token aby dostać ID token
    const signInUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=AIzaSyBk-qFQwDIlsHSnhugoQSN7abcoMX3mTl4`;
    
    const signInResponse = await fetch(signInUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true })
    });
    
    const signInData = await signInResponse.json();
    
    if (!signInData.idToken) {
      console.error('❌ Nie udało się uzyskać ID tokena');
      console.error(signInData);
      process.exit(1);
    }
    
    console.log('✅ Uzyskano ID token\n');
    
    // Teraz wywołaj API z tokenem
    const response = await fetch('https://okazjeplus.pl/api/admin/ai/command', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${signInData.idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ command: 'fillCategoriesWithDeals' })
    });
    
    const result = await response.json();
    
    console.log('📥 Odpowiedź API:');
    console.log(JSON.stringify(result, null, 2));
    console.log('');
    
    if (result.success || result.result) {
      console.log('✅ Import uruchomiony pomyślnie!');
      console.log('');
      console.log('⏳ Czekam 2 minuty na zakończenie importu...');
      
      // Czekaj 2 minuty
      await new Promise(resolve => setTimeout(resolve, 120000));
      
      console.log('');
      console.log('🔍 Sprawdzam wyniki...');
      
      // Uruchom check-deals.mjs
      const { spawn } = await import('child_process');
      const check = spawn('node', ['scripts/check-deals.mjs'], { stdio: 'inherit' });
      
      check.on('close', (code) => {
        process.exit(code || 0);
      });
    } else {
      console.error('❌ Import nie powiódł się!');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Błąd:', error.message);
    process.exit(1);
  }
}

runImport();
