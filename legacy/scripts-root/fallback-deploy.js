/**
 * Fallback: Deploy fix directly to Cloud Run if App Hosting doesn't rebuild
 * 
 * Steps:
 * 1. Make sure fix is in code
 * 2. Rebuild Next.js build locally
 * 3. Push Docker image to Cloud Run
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('\n╔════════════════════════════════════════╗');
console.log('║  FALLBACK: Manual Cloud Run Deploy    ║');
console.log('╚════════════════════════════════════════╝\n');

const steps = [
  {
    name: 'Verify fix in code',
    cmd: 'grep -n "product.rating !== undefined && product.rating !== null" src/ai/flows/importerFlow/stageDedupe.ts',
    critical: true
  },
  {
    name: 'Build Next.js',
    cmd: 'npm run build',
    critical: true
  },
  {
    name: 'Check current deployment',
    cmd: 'curl -s https://okazjeplus.pl/api/health 2>/dev/null | head -20',
    critical: false
  }
];

console.log('Checking prerequisites...\n');

let allGood = true;

for (const step of steps) {
  try {
    console.log(`▶ ${step.name}...`);
    const result = execSync(step.cmd, { cwd: '/Users/tomaszgorecki/Projekty/okazje-plus', encoding: 'utf-8' });
    
    if (result.includes('deduplicateProducts') || result.includes('undefined') || result.length > 0) {
      console.log(`  ✅ Done\n`);
    } else {
      if (step.critical) {
        console.log(`  ❌ FAILED\n`);
        allGood = false;
      } else {
        console.log(`  ⚠️ Warning\n`);
      }
    }
  } catch (error) {
    if (step.critical) {
      console.log(`  ❌ ERROR: ${error.message}\n`);
      allGood = false;
    }
  }
}

if (allGood) {
  console.log('✅ All prerequisites met\n');
  console.log('Next steps:');
  console.log('  1. Wait 5 more minutes for App Hosting rebuild');
  console.log('  2. If still broken, run: npm run build && gcloud run deploy...');
} else {
  console.log('❌ Some prerequisites failed\n');
}

process.exit(0);
