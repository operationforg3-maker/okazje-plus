#!/usr/bin/env tsx
/**
 * Check AliExpress OAuth Status
 * 
 * Verifies:
 * 1. OAuth config in Firestore
 * 2. OAuth tokens
 * 3. Token validity
 * 4. Authorization status
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

// Initialize Firebase Admin
if (getApps().length === 0) {
  const serviceAccountPath = resolve(process.cwd(), 'serviceAccountKey.json');
  const fs = require('fs');
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(
      fs.readFileSync(serviceAccountPath, 'utf-8')
    );
    initializeApp({
      credential: cert(serviceAccount),
    });
  } else {
    initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'okazje-plus'
    });
  }
}

const db = getFirestore();

async function checkOAuthStatus() {
  console.log('🔍 Checking AliExpress OAuth Status');
  console.log('====================================\n');

  try {
    // 1. Check OAuth Config
    console.log('📋 1. OAuth Configuration:');
    const configSnapshot = await db.collection('oauthConfigs').doc('aliexpress').get();
    
    if (!configSnapshot.exists) {
      console.log('   ❌ No OAuth config found for AliExpress');
    } else {
      const config = configSnapshot.data();
      console.log('   ✅ OAuth config exists');
      console.log(`      Client ID: ${config?.clientId || 'N/A'}`);
      console.log(`      Auth URL: ${config?.authorizationUrl ? '✅' : '❌'}`);
      console.log(`      Token URL: ${config?.tokenUrl ? '✅' : '❌'}`);
      console.log(`      API Endpoint: ${config?.apiEndpoint || 'N/A'}`);
      if (config?.scope) {
        console.log(`      Scopes: ${config.scope.join(', ')}`);
      }
    }

    // 2. Check OAuth Tokens
    console.log('\n📋 2. OAuth Tokens:');
    const tokensSnapshot = await db.collection('oauthTokens').where('vendor', '==', 'aliexpress').get();
    
    if (tokensSnapshot.empty) {
      console.log('   ❌ No OAuth tokens found');
    } else {
      console.log(`   ✅ Found ${tokensSnapshot.size} token(s):`);
      
      let index = 0;
      tokensSnapshot.forEach((doc) => {
        const token = doc.data();
        const now = Date.now();
        const expiresAt = token.expiresAt?.toMillis?.() || token.expiresAt;
        const isExpired = expiresAt && expiresAt < now;
        
        console.log(`\n   Token ${index + 1}:`);
        console.log(`      ID: ${doc.id}`);
        console.log(`      Vendor: ${token.vendor || 'N/A'}`);
        console.log(`      Account: ${token.accountName || 'N/A'}`);
        console.log(`      Access Token: ${token.accessToken ? '✅ ' + token.accessToken.substring(0, 20) + '...' : '❌'}`);
        console.log(`      Refresh Token: ${token.refreshToken ? '✅' : '❌'}`);
        console.log(`      Expires: ${new Date(expiresAt).toISOString()}`);
        console.log(`      Status: ${isExpired ? '🔴 EXPIRED' : '✅ VALID'}`);
        console.log(`      Created: ${new Date(token.createdAt?.toMillis?.() || token.createdAt).toISOString()}`);
        console.log(`      Updated: ${new Date(token.updatedAt?.toMillis?.() || token.updatedAt).toISOString()}`);
        index++;
      });
    }

    // 3. Summary
    console.log('\n\n📊 SUMMARY:');
    console.log('====================================');
    
    const hasConfig = configSnapshot.exists;
    const hasTokens = !tokensSnapshot.empty;
    const isAuthorized = hasConfig && hasTokens;
    
    if (isAuthorized) {
      console.log('✅ OAuth is CONFIGURED and AUTHORIZED');
      console.log('\n   Next steps:');
      console.log('   1. Use OAuth token for API calls');
      console.log('   2. Enable OAuth in code: ALIEXPRESS_USE_OAUTH=true');
      console.log('   3. Remove ALIEXPRESS_FORCE_SIGNATURE_AUTH=true');
    } else if (hasConfig && !hasTokens) {
      console.log('🟡 OAuth is CONFIGURED but NOT AUTHORIZED');
      console.log('\n   Next steps:');
      console.log('   1. Generate authorization URL: npx tsx generate-oauth-url.ts');
      console.log('   2. Open URL in browser');
      console.log('   3. Authorize the application');
      console.log('   4. Exchange code for token: npx tsx exchange-oauth-code.ts <code>');
    } else if (!hasConfig && hasTokens) {
      console.log('⚠️  OAuth tokens exist but config is missing!');
      console.log('\n   Next steps:');
      console.log('   1. Restore OAuth config: npx tsx setup-aliexpress-oauth.ts');
    } else {
      console.log('❌ OAuth is NOT CONFIGURED and NOT AUTHORIZED');
      console.log('\n   Using fallback: Signature Authentication (APP_KEY/APP_SECRET)');
      console.log('   Current config:');
      console.log(`      APP_KEY: ${process.env.ALIEXPRESS_APP_KEY || '❌ NOT SET'}`);
      console.log(`      APP_SECRET: ${process.env.ALIEXPRESS_APP_SECRET ? '✅ SET' : '❌ NOT SET'}`);
      console.log('\n   Troubleshooting:');
      console.log('   1. Verify APP_KEY is active in AliExpress portal');
      console.log('   2. Check APP_SECRET is correct');
      console.log('   3. Or configure OAuth instead');
    }

  } catch (error) {
    console.error('❌ Error checking OAuth status:', error);
    process.exit(1);
  }
}

checkOAuthStatus();
