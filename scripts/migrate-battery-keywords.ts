import { adminDb } from '../src/lib/firebase-admin';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  console.log('Migrating battery keywords to include lifepo4...');
  
  const subSubCatRef = adminDb
    .collection('categories').doc('motoryzacja')
    .collection('subcategories').doc('czesci-samochodowe')
    .collection('subcategories').doc('akumulatory');
    
  const doc = await subSubCatRef.get();
  
  if (doc.exists) {
    const data = doc.data() as any;
    const currentKeywords = data.importKeywords || data.aliexpressKeywords || [];
    
    if (!currentKeywords.some((k: string) => k.toLowerCase().includes('lifepo4'))) {
      const newKeywords = [...currentKeywords, 'lifepo4', 'lifepo4 battery'];
      await subSubCatRef.update({
        importKeywords: newKeywords,
        aliexpressKeywords: newKeywords // Update both for backward compatibility
      });
      console.log('✅ Keywords updated successfully to:', newKeywords);
      
      // Also update the import profile if it exists
      const profilesSnap = await adminDb.collection('importProfiles')
        .where('mapping.targetSubSubCategory', '==', 'akumulatory')
        .get();
        
      for (const profileDoc of profilesSnap.docs) {
        await profileDoc.ref.update({
          'filters.searchQuery': newKeywords.join(', ')
        });
        console.log(`✅ Updated import profile ${profileDoc.id} with new searchQuery.`);
      }
    } else {
      console.log('⚠️ lifepo4 is already in the keywords.');
    }
  } else {
    console.log('❌ Category not found.');
  }
}
run();
