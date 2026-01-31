import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const adminDb = admin.firestore();

function normalizeTimestamp(value) {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  // Handle Admin SDK Timestamp format {_seconds, _nanoseconds}
  if (value._seconds !== undefined) {
    return new Date(value._seconds * 1000).toISOString();
  }
  return undefined;
}

function normalizeScope(scope) {
  if (Array.isArray(scope)) return scope.filter(Boolean);
  if (typeof scope === 'string') {
    return scope.split(' ').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function normalizeOAuthConfigData(id, data) {
  const clientId = data.clientId || data.appKey || data.app_key || '';
  const clientSecret = data.clientSecret || data.appSecret || data.app_secret || '';
  const redirectUri = data.redirectUri || data.redirectURL || data.callbackUrl || data.callbackURL || '';
  const authorizationUrl = data.authorizationUrl || data.authUrl || data.authorization_endpoint || '';
  const tokenUrl = data.tokenUrl || data.token_endpoint || '';
  const scope = normalizeScope(data.scope || data.scopes || []);

  return {
    id,
    vendorId: data.vendorId || id,
    clientId,
    clientSecret,
    authorizationUrl,
    tokenUrl,
    redirectUri,
    scope,
    enabled: data.enabled !== false,
    createdAt: normalizeTimestamp(data.createdAt) || new Date().toISOString(),
    updatedAt: normalizeTimestamp(data.updatedAt),
  };
}

async function testGetConfig() {
  try {
    const configSnap = await adminDb.collection('oauthConfigs').doc('aliexpress').get();
    
    if (!configSnap.exists) {
      console.error('Config not found');
      return;
    }
    
    console.log('Raw data:', JSON.stringify(configSnap.data(), null, 2));
    console.log('\n---\n');
    
    const normalized = normalizeOAuthConfigData(configSnap.id, configSnap.data());
    console.log('Normalized:', JSON.stringify(normalized, null, 2));
    
    // Test generateAuthorizationUrl
    const state = Buffer.from(JSON.stringify({ vendorId: 'aliexpress', timestamp: Date.now() })).toString('base64url');
    
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: normalized.clientId,
      redirect_uri: normalized.redirectUri,
      scope: normalized.scope.join(' '),
      state: state,
    });
    
    const authUrl = `${normalized.authorizationUrl}?${params.toString()}`;
    console.log('\n---\n');
    console.log('Auth URL:', authUrl);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testGetConfig();
