#!/usr/bin/env node
/**
 * Set admin role for a user
 * Usage: node set-admin-role.mjs <email>
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const db = admin.firestore();

async function setAdminRole(email) {
  try {
    console.log(`🔍 Szukam użytkownika: ${email}\n`);
    
    // Find user by email
    const usersSnapshot = await db.collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();
    
    if (usersSnapshot.empty) {
      console.log('❌ Użytkownik nie znaleziony w Firestore');
      console.log('\n💡 Najpierw zaloguj się do aplikacji aby utworzyć dokument użytkownika');
      return;
    }
    
    const userDoc = usersSnapshot.docs[0];
    const userId = userDoc.id;
    
    console.log(`✅ Znaleziono użytkownika (UID: ${userId})`);
    console.log('🔧 Ustawiam rolę admin...\n');
    
    // Update role to admin
    await db.collection('users').doc(userId).update({
      role: 'admin'
    });
    
    console.log('🎉 SUKCES! Rola admin została nadana');
    console.log('\n📋 Następne kroki:');
    console.log('   1. Odśwież stronę w przeglądarce (CTRL+SHIFT+R / CMD+SHIFT+R)');
    console.log('   2. Wyloguj się i zaloguj ponownie jeśli nadal widzisz błąd');
    console.log('   3. Sprawdź czy masz dostęp do https://okazjeplus.pl/pl/admin');
    
  } catch (error) {
    console.error('❌ Błąd:', error.message);
  } finally {
    process.exit(0);
  }
}

const email = process.argv[2];

if (!email) {
  console.log('❌ Podaj email użytkownika');
  console.log('\nUżycie: node set-admin-role.mjs <email>');
  console.log('Przykład: node set-admin-role.mjs user@example.com');
  process.exit(1);
}

setAdminRole(email);
