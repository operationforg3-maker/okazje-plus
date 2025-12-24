import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function checkDeal() {
  const dealId = 'yoByeGJrUexs0ijuL7yG';
  const deal = await db.collection('deals').doc(dealId).get();
  
  if (!deal.exists) {
    console.log('❌ Deal not found');
    return;
  }
  
  const data = deal.data();
  console.log('\n📊 DEAL PRICING DETAILS:\n');
  console.log(`Deal ID: ${dealId}`);
  console.log(`Source: ${data.source}`);
  console.log(`Source ID: ${data.sourceId}`);
  console.log(`Merchant: ${data.merchant || data.merchantName || 'unknown'}`);
  
  console.log('\n💰 PRICES:');
  console.log(`Price (PLN): ${data.price}`);
  console.log(`Shipping Cost: ${data.shippingCost}`);
  console.log(`Total Price: ${data.totalPrice}`);
  console.log(`Currency: ${data.currency || 'PLN'}`);
  
  console.log('\n📦 PRICE V2 (M6):');
  if (data.priceV2) {
    console.log(`Amount: ${data.priceV2.amount}`);
    console.log(`Currency: ${data.priceV2.currency}`);
    console.log(`Original (USD): ${data.priceV2.originalAmount}`);
  } else {
    console.log('Not set');
  }
  
  console.log('\n🏷️ ADDITIONAL PRICING:');
  console.log(`Original Price: ${data.originalPrice}`);
  console.log(`Discount %: ${data.discount}`);
  
  console.log('\n🔗 PRODUCT LINK:');
  console.log(`URL: ${data.url}`);
  
  console.log('\n📅 METADATA:');
  console.log(`Imported: ${data.importedAt}`);
  console.log(`Created: ${data.createdAt}`);
  
  // Try to fetch linked ProductCore for comparison
  if (data.productCoreId) {
    const pc = await db.collection('product_cores').doc(data.productCoreId).get();
    if (pc.exists) {
      const pcData = pc.data();
      console.log('\n🔗 LINKED PRODUCTCORE:');
      console.log(`ID: ${data.productCoreId}`);
      console.log(`Title: ${typeof pcData.title === 'object' ? (pcData.title.pl || pcData.title.en) : pcData.title}`);
      console.log(`Best Price: ${pcData.bestPrice?.amount} ${pcData.bestPrice?.currency}`);
    }
  }
}

checkDeal().catch(console.error);
