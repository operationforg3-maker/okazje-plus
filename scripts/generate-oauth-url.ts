#!/usr/bin/env tsx
/**
 * Generate AliExpress OAuth Authorization URL
 * 
 * Steps:
 * 1. Run this script
 * 2. Open the authorization URL in browser
 * 3. Authorize the application
 * 4. Copy the authorization code from callback
 * 5. Run: npx tsx exchange-oauth-code.ts <code>
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

// Initialize Firebase Admin
if (getApps().length === 0) {
  const serviceAccount = JSON.parse(
    readFileSync(resolve(process.cwd(), 'serviceAccountKey.json'), 'utf-8')
  );
  
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const db = getFirestore();

async function generateOAuthUrl() {
  console.log('🔐 AliExpress OAuth Authorization URL Generator');
  console.log('================================================\n');

  try {
    // Get OAuth config
    const configDoc = await db.collection('oauthConfigs').doc('aliexpress').get();
    
    if (!configDoc.exists) {
      console.error('❌ OAuth config not found. Run: npx tsx scripts/setup-aliexpress-oauth.ts');
      process.exit(1);
    }

    const config = configDoc.data()!;
    const clientId = config.clientId;
    const authUrl = config.authorizationUrl;
    const redirectUri = config.redirectUri || 'https://okazjeplus.pl/api/auth/aliexpress/callback';
    const state = crypto.randomBytes(32).toString('hex');
    
    // Save state for verification
    await db.collection('oauthStates').doc(state).set({
      vendor: 'aliexpress',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });

    // Build authorization URL
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      state: state,
      scope: config.scope?.join(' ') || 'aliexpress.affiliate.product.query',
    });

    const fullAuthUrl = `${authUrl}?${params.toString()}`;

    console.log('📋 OAuth Configuration:');
    console.log(`   Client ID: ${clientId}`);
    console.log(`   Redirect URI: ${redirectUri}`);
    console.log(`   Scopes: ${config.scope?.join(', ')}\n`);

    console.log('🔗 Authorization URL:');
    console.log('================================================');
    console.log(fullAuthUrl);
    console.log('================================================\n');

    console.log('📝 NEXT STEPS:');
    console.log('1. Copy the URL above');
    console.log('2. Open it in your browser');
    console.log('3. Log in with your AliExpress account');
    console.log('4. Click "Authorize" to grant access');
    console.log('5. You will be redirected to the callback URL');
    console.log('6. Look for "code=..." in the URL');
    console.log('7. Run: npx tsx exchange-oauth-code.ts <authorization_code>\n');

    console.log('💾 State saved in Firestore:');
    console.log(`   State: ${state}`);
    console.log(`   Expires in: 10 minutes\n`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

generateOAuthUrl();
