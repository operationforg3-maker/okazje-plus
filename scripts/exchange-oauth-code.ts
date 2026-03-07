#!/usr/bin/env tsx
/**
 * Exchange AliExpress OAuth Code for Access Token
 *
 * Usage: npx tsx scripts/exchange-oauth-code.ts <authorization_code>
 */

import { resolve } from 'path';
import * as dotenv from 'dotenv';
import { exchangeCodeForToken } from '../src/lib/oauth';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const authCode = process.argv[2];

if (!authCode) {
  console.error('❌ Usage: npx tsx scripts/exchange-oauth-code.ts <authorization_code>');
  process.exit(1);
}

async function main() {
  console.log('🔐 Exchanging OAuth code for AliExpress token...\n');

  const token = await exchangeCodeForToken(
    'aliexpress',
    authCode,
    'system-exchange-script',
    'default',
    {
      authorizationCode: authCode.substring(0, 32),
      userAgent: 'scripts/exchange-oauth-code.ts',
    }
  );

  console.log('✅ Token exchanged and stored successfully');
  console.log(`   Token ID: ${token.id}`);
  console.log(`   Vendor: ${token.vendorId}`);
  console.log(`   Account: ${token.accountName || 'default'}`);
  console.log(`   Expires at: ${token.expiresAt}`);
  console.log(`   Status: ${token.status}`);
}

main().catch((error) => {
  console.error('❌ Exchange failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
