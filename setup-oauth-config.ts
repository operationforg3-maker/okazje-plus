/**
 * Check and setup OAuth config for AliExpress
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as serviceAccount from './serviceAccountKey.json';

initializeApp({
  credential: cert(serviceAccount as any)
});

const db = getFirestore();

async function setupOAuthConfig() {
  console.log('Checking OAuth config for AliExpress...\n');
  
  const configRef = db.collection('oauthConfigs').doc('aliexpress');
  
  try {
    const configSnap = await configRef.get();
    
    if (configSnap.exists) {
      console.log('✅ OAuth config exists:');
      console.log(JSON.stringify(configSnap.data(), null, 2));
      return;
    }
  } catch (error) {
    console.log('Config does not exist, creating...\n');
  }
  
  console.log('❌ No OAuth config found. Creating...\n');
  
  const config = {
    vendorId: 'aliexpress',
    vendorName: 'AliExpress',
    enabled: true,
    authorizationUrl: 'https://oauth.aliexpress.com/authorize',
    tokenUrl: 'https://openapi.aliexpress.com/gateway.do',
    appKey: '526032',
    appSecret: 'XOMsto3j1Der9NsAUC4J4dosRSmvMrqJ',
    callbackUrl: 'https://okazjeplus.pl/api/admin/oauth/callback',
    scopes: ['affiliate'],
    additionalParams: {
      sp: 'ae', // site parameter
      response_type: 'code',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  await configRef.set(config);
  
  console.log('✅ OAuth config created!');
  console.log(JSON.stringify(config, null, 2));
  console.log('\n');
  console.log('Now you can start OAuth flow:');
  console.log('https://okazjeplus.pl/api/admin/oauth/authorize?vendorId=aliexpress');
}

setupOAuthConfig().catch(console.error);
