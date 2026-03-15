import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');

type CliOptions = {
  execute: boolean;
  confirm: string;
  collections: string[];
};

const DEFAULT_COLLECTIONS = [
  'deals',
  'product_cores',
  'identity_matches',
  'harvester_jobs',
  'aliexpress_autopilot_runs',
  'automation_alerts',
] as const;

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    execute: argv.includes('--execute'),
    confirm: '',
    collections: [...DEFAULT_COLLECTIONS],
  };

  for (const arg of argv) {
    if (arg.startsWith('--confirm=')) {
      options.confirm = arg.slice('--confirm='.length);
    }
    if (arg.startsWith('--collections=')) {
      options.collections = arg
        .slice('--collections='.length)
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
    }
  }

  return options;
}

function initAdmin(): FirebaseFirestore.Firestore {
  if (!admin.apps.length) {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_CONFIG) {
      admin.initializeApp();
    } else {
      const serviceAccount = require('../serviceAccountKey.json');
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
  }

  return admin.firestore();
}

async function countCollection(db: FirebaseFirestore.Firestore, collectionName: string): Promise<number> {
  const snapshot = await db.collection(collectionName).count().get();
  return snapshot.data().count;
}

async function deleteCollectionInBatches(
  db: FirebaseFirestore.Firestore,
  collectionName: string,
  batchSize = 400
): Promise<number> {
  let totalDeleted = 0;

  while (true) {
    const snapshot = await db.collection(collectionName).limit(batchSize).get();
    if (snapshot.empty) {
      break;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    totalDeleted += snapshot.size;

    if (snapshot.size < batchSize) {
      break;
    }
  }

  return totalDeleted;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const db = initAdmin();

  console.log('=== M6 CANONICAL RESET PLAN ===');
  console.log(`mode: ${options.execute ? 'EXECUTE' : 'DRY-RUN'}`);
  console.log(`collections: ${options.collections.join(', ')}`);

  const plan: Array<{ collection: string; count: number }> = [];
  for (const collectionName of options.collections) {
    const count = await countCollection(db, collectionName);
    plan.push({ collection: collectionName, count });
  }

  let total = 0;
  for (const entry of plan) {
    total += entry.count;
    console.log(` - ${entry.collection}: ${entry.count}`);
  }
  console.log(`TOTAL docs selected: ${total}`);

  if (!options.execute) {
    console.log('\nDry-run complete. To execute:');
    console.log('npm run reset:m6:canonical -- --execute --confirm=RESET_M6');
    return;
  }

  if (options.confirm !== 'RESET_M6') {
    throw new Error('Missing --confirm=RESET_M6. Refusing destructive operation.');
  }

  console.log('\nExecuting deletion...');
  for (const entry of plan) {
    if (entry.count === 0) {
      console.log(` - ${entry.collection}: skipped (0)`);
      continue;
    }

    const deleted = await deleteCollectionInBatches(db, entry.collection);
    console.log(` - ${entry.collection}: deleted ${deleted}`);
  }

  console.log('Reset completed.');
}

main().catch((error) => {
  console.error('reset:m6:canonical failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
