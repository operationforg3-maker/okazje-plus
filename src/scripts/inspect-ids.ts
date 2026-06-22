import admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || 'okazje-plus'
  });
}

const db = admin.firestore();

const idsToCheck = {
  products: [
    'Lb1hIaNaEjYrL5Zbwbqn',
    'Jfqt6gLHLjTs1EfTuyfj',
    'AcGYNQZY0iRLpMq5GYRW',
    'V8Ye2yy93mQ8kttcIKwK',
    'Ks1V1WqGav8h3dTPdQdk',
    'JfKly7lw05GJUMXJxbEZ',
    'eFaTPK5cLknlBry4FrOj',
    'QANGrzM3vKE2rFkUZEHI',
    '4nmQDyzo0u5Y0CgMTulR',
    'lXz49KFKESeRsF76wjuH',
    '47jfhitxV7syZMAtleur',
    'Hpx3mWGq0zzplw6VgRII',
    '2jEPRiy3eZ1VP2lALiAg',
    '0CcvkArF10M2WOvvNDmP',
    'E7EmXEa16rF73SmrmfsJ',
    'LObWhtcN4ljhVN9dCWNl'
  ],
  deals: [
    'nKXci0e5em4fObdsUwa8',
    'uG34fMPCd0cLUCnzw2nk',
    'akmDv7VJSTFqTuj47gEq',
    'u4pUpEMbsLztVihAjSDX'
  ]
};

async function check() {
  console.log('--- STARTING ID INSPECTION ---');
  
  console.log('\n--- CHECKING PRODUCT CORES ---');
  for (const id of idsToCheck.products) {
    const doc = await db.collection('product_cores').doc(id).get();
    if (doc.exists) {
      console.log(`[product_cores] ${id} exists: status = ${doc.data()?.status}`);
    } else {
      console.log(`[product_cores] ${id} DOES NOT exist`);
    }
  }

  console.log('\n--- CHECKING PRODUCTS (LEGACY) ---');
  for (const id of idsToCheck.products) {
    const doc = await db.collection('products').doc(id).get();
    if (doc.exists) {
      console.log(`[products] ${id} exists: status = ${doc.data()?.status}`);
    } else {
      console.log(`[products] ${id} DOES NOT exist`);
    }
  }

  console.log('\n--- CHECKING DEALS ---');
  for (const id of idsToCheck.deals) {
    const doc = await db.collection('deals').doc(id).get();
    if (doc.exists) {
      console.log(`[deals] ${id} exists: status = ${doc.data()?.status}`);
    } else {
      console.log(`[deals] ${id} DOES NOT exist`);
    }
  }
}

check().catch(console.error);
