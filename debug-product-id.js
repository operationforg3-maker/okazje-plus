const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

(async () => {
  try {
    const doc = await db.collection('product_cores').doc('vBAHDu7V1WoqwNVSVxY5').get();
    if (doc.exists) {
      const data = doc.data();
      console.log('=== DOCUMENT ANALYSIS ===');
      console.log('Document ID from Firestore:', doc.id);
      console.log('Has "id" field in data?:', 'id' in data);
      console.log('Value of "id" field:', JSON.stringify(data.id));
      console.log('Type of "id" field:', typeof data.id);
      console.log('Title:', data.title);
      console.log('Status:', data.status);
      console.log('\n=== SPREAD TEST ===');
      const merged = { id: doc.id, ...data };
      console.log('After { id: doc.id, ...data } - merged.id:', JSON.stringify(merged.id));
      console.log('Type:', typeof merged.id);
    } else {
      console.log('Document does not exist in product_cores');
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
})();
