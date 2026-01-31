/**
 * Generate AliExpress OAuth Authorization URL
 * 
 * Steps:
 * 1. Run this script to get authorization URL
 * 2. Open URL in browser and authorize the app
 * 3. Copy the authorization code from callback URL
 * 4. Use code to exchange for access_token
 */

const APP_KEY = '526032';
const REDIRECT_URI = 'https://okazjeplus.pl/api/admin/oauth/callback';
const STATE = Math.random().toString(36).substring(7); // random state dla security

// AliExpress OAuth Authorization URL
const authUrl = new URL('https://oauth.aliexpress.com/authorize');
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('client_id', APP_KEY);
authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
authUrl.searchParams.set('state', STATE);
authUrl.searchParams.set('sp', 'ae'); // site parameter for AliExpress

console.log('='.repeat(80));
console.log('AliExpress OAuth Authorization');
console.log('='.repeat(80));
console.log('');
console.log('STEP 1: Open this URL in browser:');
console.log('');
console.log(authUrl.toString());
console.log('');
console.log('STEP 2: Authorize the application');
console.log('STEP 3: Copy the "code" parameter from callback URL');
console.log('');
console.log('Callback URL will be:');
console.log(`${REDIRECT_URI}?code=XXXXX&state=${STATE}`);
console.log('');
console.log('STEP 4: Run: npx tsx exchange-oauth-code.ts <CODE>');
console.log('');
console.log('='.repeat(80));
