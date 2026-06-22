import 'dotenv/config';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  if (!getApps().length) {
    const keyPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
    const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    initializeApp({ credential: cert(serviceAccount) });
  }

  const db = getFirestore();
  const docId = '40HOkpCJPPhnvyQ4u9oD';
  const doc = await db.collection('product_cores').doc(docId).get();
  if (doc.exists) {
    const data = doc.data() as any;
    console.log('--- Product Core Doc ---');
    console.log('ID:', data.id);
    console.log('Metadata:', data.metadata);
    console.log('Logistics:', data.logistics);
    console.log('Description length:', data.description ? JSON.stringify(data.description).length : 0);
    console.log('Description keys:', data.description ? Object.keys(data.description) : []);
    console.log('Description HTML length:', data.descriptionHtml ? data.descriptionHtml.length : 0);
    console.log('Description HTML snippet:', data.descriptionHtml ? data.descriptionHtml.slice(0, 300) : 'none');
    console.log('Specs Keys:', Object.keys(data.specs || {}));
    console.log('specsLocalized Keys:', Object.keys(data.specsLocalized || {}));
  } else {
    console.error('Doc not found');
  }
}

main().catch(console.error);
