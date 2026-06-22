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
  const snap = await adminDb.collection('product_cores').limit(15).get();
  console.log('Sample Product Cores statuses:');
  snap.docs.forEach(doc => {
    const data = doc.data();
    console.log(`ID: ${doc.id} | Status: ${data.status} | Title PL: ${data.title?.pl || data.title}`);
  });
}

main().catch(err => console.error(err));
