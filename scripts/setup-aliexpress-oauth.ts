#!/usr/bin/env tsx
/**
 * Setup AliExpress OAuth Configuration
 * 
 * Adds OAuth config to Firestore for AliExpress Affiliate API
 * 
 * IMPORTANT: AliExpress uses Taobao Open Platform (TOP API) which has a different
 * OAuth flow than typical OAuth 2.0. This script sets up the configuration.
 * 
 * Usage: npx tsx scripts/setup-aliexpress-oauth.ts
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load environment variables
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

async function setupAliExpressOAuth() {
  console.log('🔧 Setting up AliExpress OAuth configuration...\n');

  const appKey = process.env.ALIEXPRESS_APP_KEY;
  const appSecret = process.env.ALIEXPRESS_APP_SECRET;

  if (!appKey || !appSecret) {
    console.error('❌ ALIEXPRESS_APP_KEY and ALIEXPRESS_APP_SECRET must be set in .env.local');
    process.exit(1);
  }

  console.log('📋 Configuration:');
  console.log(`   APP_KEY: ${appKey}`);
  console.log(`   APP_SECRET: ${appSecret.substring(0, 8)}...`);
  console.log('');

  // AliExpress uses Taobao Open Platform (TOP API)
  // Documentation: https://developers.aliexpress.com/
  // 
  // IMPORTANT NOTES:
  // 1. AliExpress doesn't use standard OAuth 2.0 authorization_code flow
  // 2. Instead, they use "session key" obtained through their merchant backend
  // 3. For Affiliate API (portals API), you can use APP_KEY + APP_SECRET directly
  // 4. No OAuth flow needed for public product search
  
  const config = {
    enabled: true,
    vendorId: 'aliexpress',
    clientId: appKey,
    clientSecret: appSecret,
    
    // AliExpress TOP API endpoints
    // Note: These are for reference. Affiliate API doesn't require OAuth flow.
    authorizationUrl: 'https://oauth.aliexpress.com/authorize',
    tokenUrl: 'https://oauth.aliexpress.com/token',
    
    // API endpoints
    apiEndpoint: 'https://api-sg.aliexpress.com/sync', // Singapore endpoint (fastest for EU)
    apiEndpointBackup: 'https://openapi.aliexpress.com/gateway.do', // Backup TOP API
    
    // Scopes (for portals API)
    scope: [
      'aliexpress.affiliate.product.query',
      'aliexpress.affiliate.link.generate',
      'aliexpress.affiliate.order.list',
    ],
    
    // Callback URL (not needed for Affiliate API but required for merchant APIs)
    callbackUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:9002'}/api/admin/oauth/callback`,
    
    // Additional config
    requiresManualAuth: false, // Affiliate API works with APP_KEY/SECRET
    authType: 'signature', // Uses HMAC-MD5 signature instead of OAuth token
    
    // Rate limits
    rateLimitPerMinute: 60,
    rateLimitPerDay: 10000,
    
    // Documentation
    documentationUrl: 'https://developers.aliexpress.com/en/doc.htm?docId=108976&docType=1',
    
    // Notes
    notes: [
      'AliExpress Affiliate API (Portals API) does NOT require OAuth flow',
      'Authentication is done via HMAC-MD5 signature using APP_KEY + APP_SECRET',
      'OAuth is only needed for seller/merchant APIs (not needed for product search)',
      'Use TOP API endpoint: https://openapi.aliexpress.com/gateway.do',
      'Or Singapore endpoint: https://api-sg.aliexpress.com/sync (faster for EU)',
    ].join('\n'),
    
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    await db.collection('oauthConfigs').doc('aliexpress').set(config);
    console.log('✅ AliExpress OAuth config saved to Firestore');
    console.log('');
    console.log('📝 Important Notes:');
    console.log('   - AliExpress Affiliate API does NOT need OAuth flow');
    console.log('   - Authentication uses HMAC-MD5 signature');
    console.log('   - Your APP_KEY and APP_SECRET are sufficient');
    console.log('   - The API client will automatically use signature auth');
    console.log('');
    console.log('🧪 Test the API:');
    console.log('   npx tsx test-aliexpress.ts');
    console.log('');
    console.log('⚠️  If API returns 302/HTML instead of JSON:');
    console.log('   1. Verify APP_KEY is active in AliExpress portal');
    console.log('   2. Check if your account has Affiliate API access');
    console.log('   3. Ensure you\'re using correct API endpoint');
    console.log('   4. Try requesting new APP_KEY from AliExpress');
    console.log('');
  } catch (error) {
    console.error('❌ Failed to save config:', error);
    process.exit(1);
  }
}

setupAliExpressOAuth()
  .then(() => {
    console.log('✅ Setup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  });
