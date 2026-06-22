import { config } from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';

config();
const envLocalPath = join(process.cwd(), '.env.local');
if (existsSync(envLocalPath)) {
  config({ path: envLocalPath, override: true });
}

import { adminDb } from '../src/lib/firebase-admin';

async function main() {
  const snap = await adminDb.collection('product_cores').limit(5).get();
  snap.docs.forEach(doc => {
    const data = doc.data();
    console.log(`ID: ${doc.id} | Has embedding: ${!!data.embedding} | Type of embedding: ${Array.isArray(data.embedding) ? 'Array' : typeof data.embedding} | Length: ${data.embedding?.length}`);
  });
}

main().catch(err => console.error(err));
