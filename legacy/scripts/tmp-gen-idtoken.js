const admin = require('firebase-admin');
const fs = require('fs');
const sa = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });

async function main() {
  const uid = '8UsI6ihFDbarziFMJpJ2O5XwvTb2';
  const customToken = await admin.auth().createCustomToken(uid);
  console.log(customToken);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
