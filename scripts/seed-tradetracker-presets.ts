/**
 * Seed TradeTracker Presets for Harvester
 * Run with: npx tsx scripts/seed-tradetracker-presets.ts
 */

import { adminDb } from '../src/lib/firebase-admin';

async function seedTradeTrackerPresets() {
  console.log('--- Seeding TradeTracker Presets ---');

  const presets = [
    {
      name: 'TradeTracker - Top Vouchery i Kody Rabatowe PL',
      source: 'tradetracker',
      tradetrackerMode: 'vouchers',
      keywords: [
        'elektronika',
        'moda',
        'agd',
        'komputery',
        'sport',
        'dom i ogród',
      ],
      maxResultsPerKeyword: 50,
      active: true,
      schedule: { enabled: true, cron: '0 */6 * * *' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastRun: null,
      totalRuns: 0,
      stats: {
        totalProducts: 0,
        totalDeals: 0,
        lastRunStatus: null,
      },
    },
    {
      name: 'TradeTracker - Elektronika i Smartfony',
      source: 'tradetracker',
      tradetrackerMode: 'products',
      keywords: [
        'Apple iPhone',
        'Samsung Galaxy',
        'Sony WH-1000XM5 słuchawki',
        'laptop gamingowy',
        'PlayStation 5',
        'smartwatch',
      ],
      maxResultsPerKeyword: 50,
      active: true,
      schedule: { enabled: true, cron: '0 */12 * * *' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastRun: null,
      totalRuns: 0,
      stats: {
        totalProducts: 0,
        totalDeals: 0,
        lastRunStatus: null,
      },
    },
    {
      name: 'TradeTracker - Dom, Kuchnia i AGD',
      source: 'tradetracker',
      tradetrackerMode: 'products',
      keywords: [
        'ekspres do kawy DeLonghi',
        'robot sprzątający Dreame',
        'odkurzacz Dyson',
        'frytkownica beztłuszczowa air fryer',
        'grill elektryczny',
      ],
      maxResultsPerKeyword: 50,
      active: true,
      schedule: { enabled: true, cron: '0 8 * * *' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastRun: null,
      totalRuns: 0,
      stats: {
        totalProducts: 0,
        totalDeals: 0,
        lastRunStatus: null,
      },
    },
    {
      name: 'TradeTracker - Moda, Obuwie i Sport',
      source: 'tradetracker',
      tradetrackerMode: 'products',
      keywords: [
        'Nike Air Max sneakersy',
        'Garmin Fenix zegarek sportowy',
        'LEGO Technic',
        'kurtka trekkingowa',
      ],
      maxResultsPerKeyword: 50,
      active: true,
      schedule: { enabled: false },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastRun: null,
      totalRuns: 0,
      stats: {
        totalProducts: 0,
        totalDeals: 0,
        lastRunStatus: null,
      },
    },
  ];

  for (const preset of presets) {
    const querySnap = await adminDb
      .collection('harvester_presets')
      .where('name', '==', preset.name)
      .get();

    if (querySnap.empty) {
      const docRef = await adminDb.collection('harvester_presets').add(preset);
      console.log(`[Created] Preset: "${preset.name}" (ID: ${docRef.id})`);
    } else {
      console.log(`[Exists] Preset: "${preset.name}" (ID: ${querySnap.docs[0].id})`);
    }
  }

  console.log('✅ TradeTracker Presets seeded successfully!');
}

seedTradeTrackerPresets()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Failed to seed TradeTracker presets:', err);
    process.exit(1);
  });
