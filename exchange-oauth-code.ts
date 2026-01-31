/**
 * Exchange OAuth authorization code for access token
 * 
 * Usage: npx tsx exchange-oauth-code.ts <AUTHORIZATION_CODE>
 */

import { config } from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import * as serviceAccount from './serviceAccountKey.json';
import { createHash } from 'crypto';

config({ path: '.env.local' });

const APP_KEY = process.env.ALIEXPRESS_APP_KEY || '526032';
const APP_SECRET = process.env.ALIEXPRESS_APP_SECRET || '';

// Initialize Firebase
initializeApp({
  credential: cert(serviceAccount as any)
});

const db = getFirestore();

/**
 * Generate MD5 signature for OAuth token request
 */
function generateSignature(params: Record<string, string>): string {
  const sortedKeys = Object.keys(params).sort();
  let signString = APP_SECRET;
  
  for (const key of sortedKeys) {
    signString += key + params[key];
  }
  
  signString += APP_SECRET;
  
  return createHash('md5').update(signString).digest('hex').toUpperCase();
}

/**
 * Exchange authorization code for tokens
 */
async function exchangeCode(authCode: string) {
  console.log('Exchanging authorization code for tokens...\n');
  
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  
  const params: Record<string, string> = {
    method: 'aliexpress.system.oauth.token.get',
    app_key: APP_KEY,
    sign_method: 'md5',
    timestamp: timestamp,
    format: 'json',
    v: '2.0',
    code: authCode,
  };
  
  const signature = generateSignature(params);
  params.sign = signature;
  
  const url = new URL('https://openapi.aliexpress.com/gateway.do');
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  
  console.log('Request URL:', url.toString().substring(0, 150) + '...\n');
  
  try {
    const response = await fetch(url.toString());
    const data = await response.json();
    
    console.log('Response:', JSON.stringify(data, null, 2));
    console.log('');
    
    if (data.error_response) {
      console.error('❌ Error:', data.error_response);
      return;
    }
    
    // Extract tokens from response
    const result = data.aliexpress_system_oauth_token_get_response?.result;
    if (!result) {
      console.error('❌ No result in response');
      return;
    }
    
    const { access_token, refresh_token, expires_in } = result;
    
    if (!access_token) {
      console.error('❌ No access_token in response');
      return;
    }
    
    console.log('✅ Tokens received!');
    console.log('  Access token:', access_token.substring(0, 30) + '...');
    console.log('  Refresh token:', refresh_token ? refresh_token.substring(0, 30) + '...' : 'N/A');
    console.log('  Expires in:', expires_in, 'seconds');
    console.log('');
    
    // Store in Firestore
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expires_in * 1000);
    
    const tokenData = {
      vendorId: 'aliexpress',
      accountName: 'default',
      accessToken: access_token,
      refreshToken: refresh_token || null,
      tokenType: 'Bearer',
      expiresAt: Timestamp.fromDate(expiresAt),
      obtainedAt: Timestamp.fromDate(now),
      lastUsedAt: null,
      lastRefreshedAt: null,
      status: 'active',
      scopes: ['affiliate'],
    };
    
    const tokenRef = await db.collection('oauthTokens').add(tokenData);
    
    console.log('✅ Token stored in Firestore!');
    console.log('  Token ID:', tokenRef.id);
    console.log('');
    console.log('Now you can test API: npx tsx test-aliexpress.ts');
    
  } catch (error) {
    console.error('❌ Request failed:', error);
  }
}

// Get authorization code from command line
const authCode = process.argv[2];

if (!authCode) {
  console.error('Usage: npx tsx exchange-oauth-code.ts <AUTHORIZATION_CODE>');
  process.exit(1);
}

if (!APP_SECRET) {
  console.error('❌ ALIEXPRESS_APP_SECRET not found in .env.local');
  process.exit(1);
}

exchangeCode(authCode);
