#!/bin/bash

# Automated test runner after App Hosting rebuild
# Waits for rebuild, tests fix, and reports results

echo ""
echo "╔════════════════════════════════════════╗"
echo "║     AUTO-TEST RUNNER (Post-Deploy)    ║"
echo "╚════════════════════════════════════════╝"
echo ""

echo "⏳ Waiting 2 minutes for App Hosting rebuild..."
echo "(Second commit should trigger faster rebuild)"
echo ""

for i in {120..1}; do
    printf "\r⏳ Waiting: ${i}s remaining...  "
    sleep 1
done

echo ""
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 RUNNING DIAGNOSTICS..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Run diagnostics
node scripts/diagnose-live-import.js

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 RESULT:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Parse result
DEDUP_STATUS=$(node -e "
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();
(async () => {
  const snap = await db.collection('import_jobs').orderBy('createdAt', 'desc').limit(1).get();
  if (snap.size > 0) {
    const logs = snap.docs[0].data().logs || [];
    if (logs.length > 0) {
      const firstLog = logs[0];
      if (firstLog.stages.fetched > 0 && firstLog.stages.deduplicated > 0) {
        console.log('FIXED');
      } else if (firstLog.stages.fetched > 0 && firstLog.stages.deduplicated === 0) {
        console.log('BROKEN');
      } else {
        console.log('UNKNOWN');
      }
    }
  }
  process.exit(0);
})();
" 2>/dev/null)

if [ "$DEDUP_STATUS" = "FIXED" ]; then
    echo "✅✅✅ SUCCESS! Fix is deployed and working!"
    echo ""
    echo "Pipeline is now flowing correctly:"
    echo "  fetched → dedup ✅ → enrich → translate → save"
    echo ""
elif [ "$DEDUP_STATUS" = "BROKEN" ]; then
    echo "❌ Still broken - dedupe filtering all products"
    echo ""
    echo "This means:"
    echo "  1. App Hosting rebuild didn't complete"
    echo "  2. Or code cache wasn't cleared"
    echo ""
    echo "Fallback actions:"
    echo "  - Wait 2 more minutes"
    echo "  - Or manually rebuild with: npm run build && deploy"
    echo ""
else
    echo "⚠️ Could not determine status - check database manually"
    echo ""
fi

echo "Done!"
echo ""
