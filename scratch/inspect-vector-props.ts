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
  const doc = await adminDb.collection('product_cores').doc('0VhWet3JVoCcDWRRkWNf').get();
  const data = doc.data();
  if (data && data.embedding) {
    console.log('Constructor name:', data.embedding.constructor?.name);
    console.log('Type of toArray:', typeof data.embedding.toArray);
    if (typeof data.embedding.toArray === 'function') {
      console.log('toArray length:', data.embedding.toArray().length);
    }
  }
}

main().catch(err => console.error(err));
