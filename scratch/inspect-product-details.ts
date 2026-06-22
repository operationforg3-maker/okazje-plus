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
  const doc = await adminDb.collection('product_cores').doc('vxMOgy5bzE1HbTanqcfJ').get();
  if (doc.exists) {
    const data = doc.data();
    console.log('Title:', data.title);
    console.log('Description length:', data.description?.pl?.length || data.description?.length);
    console.log('Description preview:', (data.description?.pl || data.description || '').substring(0, 300));
  }
}

main().catch(err => console.error(err));
