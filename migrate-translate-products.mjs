#!/usr/bin/env node
/**
 * Translate ProductCore titles and descriptions using Vertex AI Gemini
 * 
 * Process:
 * 1. Fetch all approved ProductCores where EN=PL or DE=PL
 * 2. Use Vertex AI Gemini to translate title to EN and DE
 * 3. Use Gemini to translate description to EN and DE (if needed)
 * 4. Update Firestore with translations
 * 
 * Rate limit: Process in batches of 10, wait 2s between batches
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { VertexAI } from '@google-cloud/vertexai';

const serviceAccount = JSON.parse(
  readFileSync('./serviceAccountKey.json', 'utf8')
);

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

// Initialize Vertex AI
const vertexAI = new VertexAI({
  project: serviceAccount.project_id,
  location: 'europe-west1',
});

const model = vertexAI.getGenerativeModel({
  model: 'gemini-1.5-flash',
});

/**
 * Translate text using Vertex AI Gemini
 */
async function translateText(text, targetLang) {
  if (!text || typeof text !== 'string') return text;
  
  const langMap = {
    en: 'English',
    de: 'German',
  };
  
  const prompt = `Translate the following Polish product title/description to ${langMap[targetLang]}. Keep it natural and e-commerce friendly. Respond ONLY with the translation, no explanations.

Polish text: ${text}

${langMap[targetLang]} translation:`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const translation = response.candidates[0].content.parts[0].text.trim();
    return translation;
  } catch (error) {
    console.error(`  ❌ Translation error (${targetLang}):`, error.message);
    return text; // Fallback to original
  }
}

/**
 * Process one ProductCore
 */
async function translateProductCore(doc) {
  const data = doc.data();
  const id = doc.id;
  
  // Check if needs translation
  const titlePL = data.title?.pl || data.title;
  const titleEN = data.title?.en;
  const titleDE = data.title?.de;
  
  const descPL = data.description?.pl || data.description || '';
  const descEN = data.description?.en || '';
  const descDE = data.description?.de || '';
  
  const needsTitleTranslation = titleEN === titlePL || titleDE === titlePL;
  const needsDescTranslation = descEN === descPL || descDE === descPL;
  
  if (!needsTitleTranslation && !needsDescTranslation) {
    console.log(`  ⏭️  ${id}: Already translated`);
    return { translated: false };
  }
  
  console.log(`  🔄 ${id}: ${titlePL?.substring(0, 50)}...`);
  
  const updates = {};
  
  // Translate title
  if (titleEN === titlePL || !titleEN) {
    console.log(`     Translating title to EN...`);
    updates['title.en'] = await translateText(titlePL, 'en');
    await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit
  }
  
  if (titleDE === titlePL || !titleDE) {
    console.log(`     Translating title to DE...`);
    updates['title.de'] = await translateText(titlePL, 'de');
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Translate description (shorter, optional)
  if (descPL && (descEN === descPL || !descEN)) {
    console.log(`     Translating description to EN...`);
    updates['description.en'] = await translateText(descPL, 'en');
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  if (descPL && (descDE === descPL || !descDE)) {
    console.log(`     Translating description to DE...`);
    updates['description.de'] = await translateText(descPL, 'de');
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Update Firestore
  if (Object.keys(updates).length > 0) {
    await doc.ref.update(updates);
    console.log(`     ✅ Updated with ${Object.keys(updates).length} translations`);
    return { translated: true, count: Object.keys(updates).length };
  }
  
  return { translated: false };
}

async function translateAllProducts() {
  console.log('\n🌍 Starting ProductCore translation...\n');
  
  const snapshot = await db.collection('product_cores')
    .where('status', '==', 'approved')
    .get();
  
  console.log(`Found ${snapshot.size} approved products\n`);
  
  let translatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  
  for (const doc of snapshot.docs) {
    try {
      const result = await translateProductCore(doc);
      if (result.translated) {
        translatedCount++;
      } else {
        skippedCount++;
      }
    } catch (error) {
      console.error(`  ❌ Error processing ${doc.id}:`, error.message);
      errorCount++;
    }
    
    // Batch pause every 5 products
    if ((translatedCount + skippedCount + errorCount) % 5 === 0) {
      console.log(`\n  ⏸️  Pause (rate limiting)...\n`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log('\n✅ Translation complete!');
  console.log(`   Translated: ${translatedCount}`);
  console.log(`   Skipped (already done): ${skippedCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log();
}

translateAllProducts().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
