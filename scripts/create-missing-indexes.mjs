#!/usr/bin/env node
/**
 * Tworzy brakujące indeksy kompozytowe w Firestore dla produkcji.
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sa = JSON.parse(readFileSync(join(__dirname, '..', 'serviceAccountKey.json'), 'utf8'));
const projectId = sa.project_id;

const INDEX_DEFS = [
  {
    collectionGroup: 'deals',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'commentsCount', order: 'DESCENDING' },
      { fieldPath: '__name__', order: 'ASCENDING' },
    ],
  },
  {
    collectionGroup: 'deals',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'voteCount', order: 'DESCENDING' },
      { fieldPath: '__name__', order: 'ASCENDING' },
    ],
  },
  {
    collectionGroup: 'deals',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'temperature', order: 'DESCENDING' },
      { fieldPath: '__name__', order: 'ASCENDING' },
    ],
  },
];

function indexKey(def) {
  return `${def.collectionGroup}|${def.queryScope}|${def.fields.map(f => `${f.fieldPath}:${f.order || f.arrayConfig || 'NONE'}`).join(',')}`;
}

async function main() {
  const auth = new google.auth.GoogleAuth({
    credentials: sa,
    scopes: ['https://www.googleapis.com/auth/datastore'],
  });
  const client = await auth.getClient();
  const firestore = google.firestore({ version: 'v1', auth: client });

  const created = [];
  const existingMap = new Set();

  for (const def of INDEX_DEFS) {
    const parent = `projects/${projectId}/databases/(default)/collectionGroups/${def.collectionGroup}`;
    const res = await firestore.projects.databases.collectionGroups.indexes.list({ parent });
    const idxs = res.data.indexes || [];
    idxs.forEach(idx => {
      const key = indexKey({
        collectionGroup: def.collectionGroup,
        queryScope: idx.queryScope,
        fields: idx.fields || [],
      });
      existingMap.add(key);
    });
  }

  for (const def of INDEX_DEFS) {
    const key = indexKey(def);
    if (existingMap.has(key)) {
      console.log(`✅ Index already exists: ${key}`);
      continue;
    }
    const parent = `projects/${projectId}/databases/(default)/collectionGroups/${def.collectionGroup}`;
    const res = await firestore.projects.databases.collectionGroups.indexes.create({
      parent,
      requestBody: {
        queryScope: def.queryScope,
        fields: def.fields,
      },
    });
    created.push({ key, operation: res.data.name });
    console.log(`🚀 Creating index ${key} → ${res.data.name}`);
  }

  if (created.length === 0) {
    console.log('Nothing to create.');
  } else {
    console.log('Created indexes:', created);
  }
}

main().catch(err => {
  console.error('❌ Index creation failed:', err.response?.data || err.message || err);
  process.exit(1);
});
