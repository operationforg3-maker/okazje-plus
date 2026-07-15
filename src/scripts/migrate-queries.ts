import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import admin from 'firebase-admin';

if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || 'okazje-plus'
  });
}

import { ensureAliExpressImportProfilesCoverage } from '../lib/import-profiles-bootstrap';

async function run() {
  console.log('=== STARTING IMPORT PROFILE QUERY MIGRATION ===');
  
  // Dry run first
  console.log('\n--- Running Dry Run ---');
  const dryResult = await ensureAliExpressImportProfilesCoverage({
    updateQueries: true,
    dryRun: true
  });
  console.log('Dry Run Result:', dryResult);
  
  // Real run
  console.log('\n--- Running Real Migration ---');
  const result = await ensureAliExpressImportProfilesCoverage({
    updateQueries: true,
    dryRun: false
  });
  console.log('Migration Result:', result);
  
  console.log('\n=== MIGRATION COMPLETE ===');
}

run().catch(console.error);
