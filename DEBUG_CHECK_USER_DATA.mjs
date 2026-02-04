#!/usr/bin/env node
/**
 * DEBUG: Sprawdź dokładnie co znajduje się w Firestore dla zalogowanego użytkownika
 * Uruchom: node DEBUG_CHECK_USER_DATA.mjs
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

// Załaduj service account key
const keyPath = './serviceAccountKey.json';
if (!fs.existsSync(keyPath)) {
  console.error('❌ Nie znaleziono serviceAccountKey.json!');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
});

const db = admin.firestore();

// ===== ZMIEŃ TĘ WARTOŚĆ NA SWÓJ UID =====
// Możesz znaleźć swój UID:
// 1. Zaloguj się do aplikacji
// 2. Otwórz DevTools → Console
// 3. Wpisz: firebase.auth().currentUser.uid
const TARGET_UID = 'AnyqCvL1YhMxhPUO4kAB8zPfDXm2'; // ← ZMIEŃ TO

console.log('🔍 Szukam danych dla UID:', TARGET_UID);
console.log('━'.repeat(80));

(async () => {
  try {
    // ===== 1. Sprawdzenie DEALS =====
    console.log('\n1️⃣  DEALS (createdBy):');
    const dealsSnap = await db.collection('deals').where('createdBy', '==', TARGET_UID).limit(5).get();
    console.log(`   Znaleziono: ${dealsSnap.docs.length} deals`);
    dealsSnap.docs.forEach((doc, idx) => {
      const data = doc.data();
      console.log(`   [${idx + 1}] ${doc.id}:`);
      console.log(`      title: ${data.title || data.title?.pl || '?'}`);
      console.log(`      createdBy: ${data.createdBy}`);
      console.log(`      createdAt: ${new Date(data.createdAt?.toDate?.() || 0).toISOString()}`);
    });

    // ===== 2. Sprawdzenie COMMENTS (collectionGroup) =====
    console.log('\n2️⃣  COMMENTS (userId - collectionGroup):');
    try {
      const commentsSnap = await db.collectionGroup('comments')
        .where('userId', '==', TARGET_UID)
        .limit(5)
        .get();
      console.log(`   Znaleziono: ${commentsSnap.docs.length} comments`);
      commentsSnap.docs.forEach((doc, idx) => {
        const data = doc.data();
        const path = doc.ref.path;
        console.log(`   [${idx + 1}] ${path}:`);
        console.log(`      content: ${(data.content || '').substring(0, 50)}...`);
        console.log(`      userId: ${data.userId}`);
        console.log(`      createdAt: ${new Date(data.createdAt?.toDate?.() || 0).toISOString()}`);
      });
    } catch (err) {
      console.log(`   ❌ ERROR: ${err.message}`);
    }

    // ===== 3. Sprawdzenie FORUM POSTS =====
    console.log('\n3️⃣  FORUM POSTS (authorId):');
    try {
      const forumSnap = await db.collection('forumPosts')
        .where('authorId', '==', TARGET_UID)
        .limit(5)
        .get();
      console.log(`   Znaleziono: ${forumSnap.docs.length} forum posts`);
      forumSnap.docs.forEach((doc, idx) => {
        const data = doc.data();
        console.log(`   [${idx + 1}] ${doc.id}:`);
        console.log(`      title: ${data.title || '?'}`);
        console.log(`      authorId: ${data.authorId}`);
      });
    } catch (err) {
      console.log(`   ❌ ERROR: ${err.message}`);
    }

    // ===== 4. Sprawdzenie VOTES (w subkolekcji każdego deal'a) =====
    console.log('\n4️⃣  VOTES (w deals/{dealId}/votes):');
    try {
      const allDealsSnap = await db.collection('deals').limit(50).get();
      let totalVotes = 0;
      let dealsWithVotes = 0;

      for (const dealDoc of allDealsSnap.docs) {
        try {
          const votesSnap = await db.collection(`deals/${dealDoc.id}/votes`)
            .where('userId', '==', TARGET_UID)
            .get();
          
          if (votesSnap.docs.length > 0) {
            dealsWithVotes++;
            totalVotes += votesSnap.docs.length;
            console.log(`   Deal ${dealDoc.id}: ${votesSnap.docs.length} votes`);
          }
        } catch (e) {
          // Silent
        }
      }
      console.log(`   Łącznie: ${totalVotes} votes w ${dealsWithVotes} deals`);
    } catch (err) {
      console.log(`   ❌ ERROR: ${err.message}`);
    }

    // ===== 5. Sprawdzenie PRODUCT RATINGS =====
    console.log('\n5️⃣  PRODUCT RATINGS:');
    try {
      // Spróbuj productRatings collection
      const ratingsSnap = await db.collection('productRatings')
        .where('userId', '==', TARGET_UID)
        .limit(5)
        .get();
      
      if (ratingsSnap.docs.length > 0) {
        console.log(`   Found in productRatings: ${ratingsSnap.docs.length}`);
        ratingsSnap.docs.forEach((doc, idx) => {
          const data = doc.data();
          console.log(`   [${idx + 1}] ${doc.id}: rating=${data.rating}`);
        });
      } else {
        console.log(`   productRatings collection: 0 docs`);
      }
    } catch (err) {
      console.log(`   productRatings: ${err.message}`);
    }

    // ===== 6. SUMMARY =====
    console.log('\n' + '━'.repeat(80));
    console.log('📊 SUMMARY:');
    console.log(`   Target UID: ${TARGET_UID}`);
    console.log('   Jeśli wszystkie liczniki to 0, znaczy że:');
    console.log('   ✓ User nie ma żadnych deals');
    console.log('   ✓ User nie ma żadnych comments');
    console.log('   ✓ User nie ma żadnych forum posts');
    console.log('   ✓ User nie ma żadnych votes');
    console.log('   ✓ User nie ma żadnych ratings');
    console.log('\n   To jest NORMALNE dla nowego użytkownika!');
    console.log('   Problem jest w tym że UI pokazuje 0 zamiast tych wartości.');
    console.log('━'.repeat(80));

    process.exit(0);
  } catch (error) {
    console.error('💥 Fatal error:', error.message);
    process.exit(1);
  }
})();
