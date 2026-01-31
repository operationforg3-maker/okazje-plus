/**
 * Update OAuth config for AliExpress with new credentials
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as serviceAccount from './serviceAccountKey.json';

initializeApp({
  credential: cert(serviceAccount as any)
});

const db = getFirestore();

async function updateOAuthConfig() {
  console.log('Updating OAuth config for AliExpress...\n');
  
  const configRef = db.collection('oauthConfigs').doc('aliexpress');
  
  const updates = {
    clientSecret: 'XOMsto3j1Der9NsAUC4J4dosRSmvMrqJ',
    callbackUrl: 'https://okazjeplus.pl/api/admin/oauth/callback',
    updatedAt: new Date(),
  };
  
  await configRef.update(updates);
  
  console.log('✅ OAuth config updated!');
  console.log(JSON.stringify(updates, null, 2));
  console.log('\n');
  console.log('Start OAuth flow by opening this URL:');
  console.log('https://okazjeplus.pl/api/admin/oauth/authorize?vendorId=aliexpress');
}

updateOAuthConfig().catch(console.error);
