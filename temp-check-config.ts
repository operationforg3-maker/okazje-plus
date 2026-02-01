import { config } from 'dotenv';
config({ path: '.env.local' });
import * as admin from 'firebase-admin';
import serviceAccount from './serviceAccountKey.json';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount)
  });
}

const db = admin.firestore();

(async () => {
  try {
    const doc = await db.collection('oauthConfigs').doc('aliexpress').get();
    const data = doc.data();
    
    console.log('=== AliExpress OAuth Config ===');
    console.log('authType:', data?.authType);
    console.log('requiresManualAuth:', data?.requiresManualAuth);
    console.log('\n=== Notes ===');
    console.log(data?.notes);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
})();
