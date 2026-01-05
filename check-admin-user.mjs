#!/usr/bin/env node
/**
 * Quick script to check if current user has admin role
 * Usage: node check-admin-user.mjs <email>
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

async function checkUserRole(email) {
  try {
    console.log(`🔍 Sprawdzam użytkownika: ${email}\n`);
    
    // Find user by email
    const usersSnapshot = await db.collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();
    
    if (usersSnapshot.empty) {
      console.log('❌ Użytkownik nie znaleziony w bazie Firestore');
      console.log('\n💡 Zaloguj się raz do aplikacji aby utworzyć dokument użytkownika');
      return;
    }
    
    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();
    
    console.log('✅ Użytkownik znaleziony:');
    console.log(`   UID: ${userDoc.id}`);
    console.log(`   Email: ${userData.email}`);
    console.log(`   DisplayName: ${userData.displayName || '(brak)'}`);
    console.log(`   Role: ${userData.role || '(brak - domyślnie "user")'}`);
    console.log();
    
    if (userData.role === 'admin') {
      console.log('🎉 Użytkownik JUŻ MA rolę admin!');
    } else {
      console.log('⚠️  Użytkownik NIE MA roli admin');
      console.log('\n🔧 Aby nadać rolę admin, uruchom:');
      console.log(`   node set-admin-role.mjs ${email}`);
    }
    
  } catch (error) {
    console.error('❌ Błąd:', error.message);
  } finally {
    process.exit(0);
  }
}

const email = process.argv[2];

if (!email) {
  console.log('❌ Podaj email użytkownika');
  console.log('\nUżycie: node check-admin-user.mjs <email>');
  console.log('Przykład: node check-admin-user.mjs user@example.com');
  process.exit(1);
}

checkUserRole(email);
