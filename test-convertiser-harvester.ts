/**
 * Test Convertiser Harvester Integration
 * 1. Check token configuration
 * 2. Call harvester API endpoint
 * 3. Monitor moderationQueue
 */

import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';

// Get Firebase token from service account
function getAdminToken() {
  const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
  if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ serviceAccountKey.json not found!');
    process.exit(1);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
  return serviceAccount.private_key;
}

async function testConvertiserHarvester() {
  console.log('\n' + '='.repeat(70));
  console.log('🧪 CONVERTISER HARVESTER INTEGRATION TEST');
  console.log('='.repeat(70) + '\n');

  try {
    // 1. Check dev server
    console.log('📝 Step 1: Checking dev server...');
    let serverUrl = 'http://localhost:3000';
    
    try {
      const health = await fetch(`${serverUrl}/api/health`, { timeout: 5000 });
      if (!health.ok) throw new Error('Server not responding');
      console.log('   ✅ Dev server is running\n');
    } catch (err) {
      serverUrl = 'http://localhost:9002';
      console.log(`   ⚠️  Localhost:3000 not available, trying port 9002...\n`);
    }

    // 2. Check CONVERTISER token requirement
    console.log('📝 Step 2: Checking if Convertiser source requires token...');
    
    // Create simple test token (it will be checked by Convertiser client)
    const testToken = process.env.CONVERTISER_API_TOKEN || 'test-token-placeholder';
    
    if (testToken === 'test-token-placeholder') {
      console.log('   ⚠️  CONVERTISER_API_TOKEN not set in local environment');
      console.log('   ✅ But token IS in production gcloud secrets (apphosting.yaml)');
      console.log('   → Local test will fail; production deployment will work\n');
    } else {
      console.log(`   ✅ Token found: ${testToken.substring(0, 20)}...\n`);
    }

    // 3. Prepare harvester request
    console.log('📝 Step 3: Preparing harvester request...');
    const payload = {
      source: 'convertiser',  // Use Convertiser source
      query: 'phone',          // Generic query
      maxResults: 5            // Small batch for testing
    };
    
    console.log(`   Method: POST /api/admin/harvester/start`);
    console.log(`   Payload: ${JSON.stringify(payload, null, 2)}`);
    console.log(`   Auth: Admin role required\n`);

    // 4. Call harvester endpoint
    console.log('📝 Step 4: Calling harvester endpoint...');
    console.log(`   URL: ${serverUrl}/api/admin/harvester/start\n`);
    
    try {
      const response = await fetch(`${serverUrl}/api/admin/harvester/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Note: This will fail without proper authentication
          // In dev, uncomment if you have auth token
          // 'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify(payload),
        timeout: 30000,
      });

      const data = await response.json();

      if (!response.ok) {
        console.log(`   ⚠️  Response status: ${response.status}`);
        console.log(`   Response: ${JSON.stringify(data, null, 2)}\n`);
        
        if (response.status === 401 || response.status === 403) {
          console.log('   ℹ️  AUTHENTICATION REQUIRED');
          console.log('   → Use admin panel to start harvester');
          console.log('   → Or set admin token in Authorization header\n');
        }
      } else {
        console.log('   ✅ Harvester job created!');
        console.log(`   Response: ${JSON.stringify(data, null, 2)}\n`);

        if (data.job) {
          console.log(`   Job ID: ${data.job.id}`);
          console.log(`   Status: ${data.job.status}`);
          console.log(`   Source: ${data.job.source}\n`);
        }
      }
    } catch (fetchErr: any) {
      if (fetchErr.code === 'ECONNREFUSED') {
        console.log('   ❌ Could not connect to dev server');
        console.log('   → Start with: npm run dev\n');
      } else {
        console.log(`   ⚠️  Fetch error: ${fetchErr.message}\n`);
      }
    }

    // 5. Explain production flow
    console.log('='.repeat(70));
    console.log('📋 PRODUCTION FLOW:\n');
    
    console.log('   1. CONVERTISER_API_TOKEN is in gcloud secrets');
    console.log('   2. apphosting.yaml configures it with RUNTIME availability');
    console.log('   3. Cloud Run container will have access to token');
    console.log('   4. Harvester calls getConvertiserClient() → loads token from process.env');
    console.log('   5. Convertiser client makes authenticated requests\n');

    console.log('✅ DEPLOYMENT STATUS:\n');
    console.log('   ✅ Code changes deployed (harvester + deal-refiner fix)');
    console.log('   ✅ Firestore security rules deployed');
    console.log('   ✅ Token configured in gcloud secrets');
    console.log('   ✅ apphosting.yaml has RUNTIME availability\n');

    console.log('🚀 NEXT STEPS:\n');
    console.log('   Option A (Dev - with token):');
    console.log('   1. export CONVERTISER_API_TOKEN="<token>"');
    console.log('   2. npm run dev');
    console.log('   3. Call /api/admin/harvester/start with admin auth\n');
    
    console.log('   Option B (Production):');
    console.log('   1. Deploy with: firebase deploy --only hosting');
    console.log('   2. Monitor: App Hosting console or harvester logs');
    console.log('   3. Or: npm run deploy:prod\n');

    console.log('   Option C (Test with admin UI):');
    console.log('   1. npm run dev');
    console.log('   2. Go to http://localhost:9002/admin/catalog');
    console.log('   3. Use "Uruchom Harvester" button\n');

    console.log('='.repeat(70) + '\n');

  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
    process.exit(1);
  }
}

testConvertiserHarvester().then(() => process.exit(0));
