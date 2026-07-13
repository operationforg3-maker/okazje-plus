const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

async function run() {
  console.log("Fetching deals...");
  const deals = await db.collection('deals').orderBy('createdAt', 'desc').limit(20).get();
  console.log("Deals found:", deals.size);
  for (const d of deals.docs) {
    console.log('Deal:', d.id, 'status:', d.data().status, 'title:', d.data().title?.pl?.substring(0,30), 'image:', d.data().image);
  }
}
run();
