#!/usr/bin/env tsx
/**
 * Exchange AliExpress OAuth Code for Access Token
 * 
 * Usage: npx tsx exchange-oauth-code.ts <authorization_code>
 * 
 * Gets called after user authorizes the app
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as dotenv from 'dotenv';
import https from 'https';

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

const authCode = process.argv[2];

if (!authCode) {
  console.error('❌ Usage: npx tsx exchange-oauth-code.ts <authorization_code>');
  process.exit(1);
}

async function exchangeCodeForToken() {
  console.log('🔐 Exchanging OAuth Code for Access Token');
  console.log('==========================================\n');

  try {
    // Get OAuth config
    const configDoc = await db.collection('oauthConfigs').doc('aliexpress').get();
    
    if (!configDoc.exists) {
      console.error('❌ OAuth config not found');
      process.exit(1);
    }

    const config = configDoc.data()!;
    const clientId = config.clientId;
    const clientSecret = config.clientSecret;
    const tokenUrl = config.tokenUrl;
    const redirectUri = config.redirectUri || 'https://okazjeplus.pl/api/auth/aliexpress/callback';

    console.log('📋 Configuration:');
    console.log(`   Client ID: ${clientId}`);
    console.log(`   Token URL: ${tokenUrl}`);
    console.log(`   Authorization Code: ${authCode.substring(0, 20)}...\n`);

    // Request token
    console.log('📤 Exchanging code for token...');
    
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code: authCode,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    });

    return new Promise((resolve, reject) => {
      const postData = params.toString();
      
      const options = {
        hostname: new URL(tokenUrl).hostname,
        path: new URL(tokenUrl).pathname + new URL(tokenUrl).search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
        },
      };

      const req = https.request(options, async (res) => {
        let data = '';
        
        res.on('data', chunk => data += chunk);
        res.on('end', async () => {
          try {
            const response = JSON.parse(data);
            
            if (response.error) {
              console.error(`❌ Error: ${response.error}`);
              console.error(`   ${response.error_description || ''}`);
              process.exit(1);
            }

            console.log('✅ Token received!\n');
            console.log('📋 Token Details:');
            console.log(`   Access Token: ${response.access_token.substring(0, 30)}...`);
            console.log(`   Token Type: ${response.token_type}`);
            console.log(`   Expires In: ${response.expires_in} seconds`);
            if (response.refresh_token) {
              console.log(`   Refresh Token: ${response.refresh_token.substring(0, 30)}...`);
            }

            // Save token to Firestore
            console.log('\n💾 Saving token to Firestore...');
            
            const now = new Date();
            const expiresAt = new Date(now.getTime() + (response.expires_in || 3600) * 1000);
            
            const tokenData = {
              vendor: 'aliexpress',
              accountName: 'default',
              accessToken: response.access_token,
              refreshToken: response.refresh_token || null,
              tokenType: response.token_type || 'Bearer',
              expiresAt: expiresAt,
              createdAt: now,
              updatedAt: now,
              scope: config.scope,
            };

            await db.collection('oauthTokens').doc(`aliexpress_default_${Date.now()}`).set(tokenData);
            
            console.log('✅ Token saved to Firestore!\n');
            console.log('🎉 OAuth Authorization Complete!');
            console.log('   You can now use the OAuth token for API calls.');
            console.log('   Run: npm run dev (to use the token)\n');
            
            resolve(response);
          } catch (error) {
            console.error('❌ Failed to parse response:', error);
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        console.error('❌ Request error:', error);
        reject(error);
      });

      req.write(postData);
      req.end();
    });
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

exchangeCodeForToken().catch(console.error);
