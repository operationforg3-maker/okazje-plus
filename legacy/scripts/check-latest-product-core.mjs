#!/usr/bin/env node
import admin from 'firebase-admin';
import fs from 'fs';

const sa = JSON.parse(fs.readFileSync('./serviceAccountKey.json','utf8'));
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

function fmt(v){
  if(v == null) return '—';
  if(typeof v === 'string') return v.slice(0,120);
  return JSON.stringify(v).slice(0,120);
}

async function main(){
  console.log('🔎 Checking latest ProductCore & linked Deals...');
  const coresSnap = await db.collection('product_cores')
    .orderBy('updatedAt','desc')
    .limit(3)
    .get();

  if(coresSnap.empty){
    console.log('❌ No product_cores found');
    process.exit(1);
  }

  let idx = 0;
  for(const doc of coresSnap.docs){
    idx++;
    const p = doc.data();
    console.log(`\n#${idx} ProductCore ${doc.id}`);
    const title = typeof p.title === 'object' ? (p.title.pl || p.title.en || p.title.de) : p.title;
    console.log(`  • Title: ${fmt(title)}`);
    console.log(`  • Images: ${Array.isArray(p.images)? p.images.length : 0}`);
    console.log(`  • BestPrice: ${p.bestPrice?.amount ?? '—'} ${p.bestPrice?.currency ?? ''}`);
    console.log(`  • Status: ${p.status}`);
    console.log(`  • Specs keys: ${Object.keys(p.specs||{}).slice(0,8).join(', ')}`);
    const descPL = p.description?.pl || p.shortDescription?.pl || p.fullDescription?.pl;
    const descEN = p.description?.en || p.shortDescription?.en || p.fullDescription?.en;
    console.log(`  • Description[PL]: ${fmt(descPL)}`);
    console.log(`  • Description[EN]: ${fmt(descEN)}`);
    console.log(`  • Pros/Cons: pros=${(p.pros?.pl||[]).length} cons=${(p.cons?.pl||[]).length}`);

    const dealsSnap = await db.collection('deals')
      .where('productCoreId','==', doc.id)
      .orderBy('createdAt','desc')
      .limit(5)
      .get();
    console.log(`  • Linked deals: ${dealsSnap.size}`);
    if(!dealsSnap.empty){
      const d = dealsSnap.docs[0].data();
      console.log(`    ◦ Deal[0]: ${d.source} price=${d.price?.amount ?? d.price} + ship=${d.shipping?.cost ?? d.shippingCost ?? 0}`);
      console.log(`    ◦ Affiliate: ${fmt(d.affiliateLink || d.sourceUrl)}`);
    }
  }

  await admin.app().delete();
}

main().catch(e=>{console.error(e);process.exit(1);});
