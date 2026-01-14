import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('serviceAccountKey.json', 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const db = admin.firestore();

async function listUsers() {
  const snapshot = await db.collection('users').limit(10).get();
  
  console.log(`\n👥 Lista użytkowników (max 10):\n`);
  
  if (snapshot.empty) {
    console.log('❌ Brak użytkowników w bazie danych');
    console.log('\n💡 Musisz się najpierw zarejestrować w aplikacji:');
    console.log('   http://localhost:9002/pl/register\n');
    return;
  }
  
  snapshot.forEach(doc => {
    const data = doc.data();
    console.log(`📧 Email: ${data.email || 'brak'}`);
    console.log(`   UID: ${doc.id}`);
    console.log(`   Role: ${data.role || 'user'}`);
    console.log(`   Created: ${data.createdAt || 'brak'}`);
    console.log('');
  });
  
  console.log('Aby nadać rolę admin, użyj:');
  console.log('node set-admin-role.mjs <email>\n');
}

listUsers().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
