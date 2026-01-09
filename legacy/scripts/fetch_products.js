const admin = require('firebase-admin');
const path = require('path');
const serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));

admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'okazje-plus' });
const db = admin.firestore();

async function fetchLatest() {
  try {
    let snap;
    try {
      snap = await db.collection('products').orderBy('createdAt', 'desc').limit(10).get();
    } catch (err) {
      console.warn('orderBy(createdAt) failed, falling back to simple limit:', err.message);
      snap = await db.collection('products').limit(10).get();
    }

    console.log(`Found ${snap.size} products`);
    snap.forEach(doc => {
      const d = doc.data();
      console.log(JSON.stringify({
        id: doc.id,
        name: d.name || d.title || 'N/A',
        price: d.price?.amount || d.price || null,
        currency: d.price?.currency || d.currency || null,
        status: d.status,
        image: d.image || null,
        mainCategorySlug: d.mainCategorySlug,
        subCategorySlug: d.subCategorySlug,
        subSubCategorySlug: d.subSubCategorySlug,
        createdAt: d.createdAt || d.created_at || null,
      }, null, 2));
    });
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    admin.app().delete();
  }
}

fetchLatest();
