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
  const col = adminDb.collection('product_cores');
  console.log('findNearest function string representation:');
  console.log(col.findNearest.toString());
}

main().catch(err => console.error(err));
