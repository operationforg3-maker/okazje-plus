/**
 * Check OAuth tokens in Firestore
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as serviceAccount from './serviceAccountKey.json';

initializeApp({
  credential: cert(serviceAccount as any)
});

const db = getFirestore();

async function checkOAuthTokens() {
  console.log('Checking OAuth tokens for AliExpress...\n');
  
  try {
    const tokensSnapshot = await db.collection('oauthTokens')
      .where('vendorId', '==', 'aliexpress')
      .get();
    
    if (tokensSnapshot.empty) {
      console.log('❌ No OAuth tokens found for AliExpress');
      console.log('\nTo fix:');
      console.log('1. Go to AliExpress Open Platform');
      console.log('2. Generate OAuth authorization code');
      console.log('3. Exchange code for access_token + refresh_token');
      console.log('4. Store in Firestore oauthTokens collection');
      return;
    }
    
    console.log(`✅ Found ${tokensSnapshot.size} token(s):\n`);
    
    tokensSnapshot.forEach(doc => {
      const token = doc.data();
      const now = new Date();
      const expiresAt = token.expiresAt?.toDate();
      const isExpired = expiresAt && expiresAt < now;
      
      console.log(`Token ID: ${doc.id}`);
      console.log(`  Status: ${token.status}`);
      console.log(`  Account: ${token.accountName || 'default'}`);
      console.log(`  Expires: ${expiresAt?.toISOString()}`);
      console.log(`  Expired: ${isExpired ? '❌ YES' : '✅ NO'}`);
      console.log(`  Has refresh token: ${token.refreshToken ? '✅' : '❌'}`);
      console.log(`  Access token: ${token.accessToken?.substring(0, 20)}...`);
      console.log('');
    });
    
  } catch (error) {
    console.error('Error checking tokens:', error);
  }
}

checkOAuthTokens();
