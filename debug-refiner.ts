
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import serviceAccount from './serviceAccountKey.json' with { type: 'json' };

// Initialize Firebase Admin
if (!process.env.FIREBASE_PROJECT_ID) {
  process.env.FIREBASE_PROJECT_ID = serviceAccount.project_id;
}

// Force Vertex AI env vars if missing (example)
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIza..."; // We rely on ADC or .env.local usually, but here we might need to be careful.
// Ideally, we import from src/lib/automation/refiner.ts but we need to mock the context or ensure environment is set.

// We will use the existing AIRefiner class but we need to register flows first?
// In automated environment, flows are registered by importing src/index.ts or src/ai/genkit.ts?
// Genkit often needs initialization.

// Let's try to import AIRefiner and run it.
import { AIRefiner } from './src/lib/automation/refiner';
import { getApps } from 'firebase-admin/app';

if (getApps().length === 0) {
    const app = initializeApp({
    credential: cert(serviceAccount as any)
    });
}

const productId = 'EDF4qMoK3L8lpwqDq9Mt'; // The failed product

async function debugRefinement() {
  console.log(`Debug Refinement for ${productId}...`);
  
  const refiner = new AIRefiner('debug-job');
  
  try {
    const refined = await refiner.refineProducts([productId], 'full_enrichment', false);
    console.log('Refinement result:', JSON.stringify(refined, null, 2));
  } catch (err: any) {
    console.error('Refinement FAILED:', err);
    if (err.cause) console.error('Cause:', err.cause);
    if (err.stack) console.error('Stack:', err.stack);
  }
}

debugRefinement();
