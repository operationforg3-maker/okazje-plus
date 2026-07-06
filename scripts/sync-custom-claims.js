/**
 * scripts/sync-custom-claims.js
 *
 * Migration script: sets Firebase Auth custom claims for all users
 * whose Firestore role is admin, moderator, or specjalista.
 *
 * Run: node scripts/sync-custom-claims.js
 *
 * This is idempotent — safe to re-run.
 */

const admin = require('firebase-admin');
const path = require('path');

const saPath = path.join(__dirname, '..', 'serviceAccountKey.json');
const serviceAccount = require(saPath);

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();
const auth = admin.auth();

const PRIVILEGED_ROLES = ['admin', 'moderator', 'specjalista'];

async function buildClaims(role) {
  const claims = { role };
  if (role === 'admin') claims.admin = true;
  if (role === 'moderator') claims.moderator = true;
  return claims;
}

async function main() {
  console.log('🔍 Fetching users with privileged roles from Firestore...');

  const usersSnap = await db.collection('users')
    .where('role', 'in', PRIVILEGED_ROLES)
    .get();

  console.log(`Found ${usersSnap.size} privileged user(s).`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const doc of usersSnap.docs) {
    const uid = doc.id;
    const data = doc.data();
    const role = data.role;

    try {
      // Check current claims
      const user = await auth.getUser(uid);
      const currentClaims = user.customClaims || {};
      const expectedClaims = await buildClaims(role);

      // Check if claims are already correct
      const alreadyCorrect = Object.entries(expectedClaims)
        .every(([k, v]) => currentClaims[k] === v);

      if (alreadyCorrect) {
        console.log(`  ⏭️  ${uid} (${data.email || 'no email'}) — ${role} — already has correct claims`);
        skipped++;
        continue;
      }

      await auth.setCustomUserClaims(uid, expectedClaims);
      console.log(`  ✅ ${uid} (${data.email || 'no email'}) — ${role} — claims set:`, expectedClaims);
      updated++;
    } catch (err) {
      console.error(`  ❌ ${uid} — Error: ${err.message}`);
      errors++;
    }
  }

  console.log('\n📊 Summary:');
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped (already correct): ${skipped}`);
  console.log(`  Errors: ${errors}`);
  console.log('\n⚠️  Users must log out and log back in for new claims to take effect.');
}

main().then(() => process.exit(0)).catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
