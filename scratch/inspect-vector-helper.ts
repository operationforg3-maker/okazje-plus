import { config } from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';

config();
const envLocalPath = join(process.cwd(), '.env.local');
if (existsSync(envLocalPath)) {
  config({ path: envLocalPath, override: true });
}

import * as admin from 'firebase-admin';
import { adminDb } from '../src/lib/firebase-admin';

async function main() {
  console.log('admin.firestore.FieldValue.vector type:', typeof (admin.firestore.FieldValue as any).vector);
  console.log('admin.firestore.VectorValue type:', typeof (admin.firestore as any).VectorValue);
}

main().catch(err => console.error(err));
