
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkDeals() {
  console.log('Fetching deals with potentially problematic prices...');
  // Check for 0 price or missing amount
  const snapshot = await db.collection('deals').limit(50).get();
  
  let suspicious = 0;
  snapshot.forEach(doc => {
    const data = doc.data();
    let price = 0;
    if (typeof data.price === 'number') price = data.price;
    else if (data.price) price = data.price.amount;
    
    if (!price || price === 0) {
      console.log('!!! SUSPICIOUS DEAL:', doc.id);
      console.log('Price:', data.price);
      console.log('Legacy:', data.legacyPrice);
      suspicious++;
    }
  });
  
  console.log(`Checked ${snapshot.size} deals. Found ${suspicious} suspicious.`);
}

checkDeals().catch(console.error);
