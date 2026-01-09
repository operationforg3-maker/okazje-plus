import { adminDb } from '../lib/firebase-admin';

async function seedImportProfiles() {
  console.log('Seeding import profiles...');

  const profiles = [
    {
      vendorId: 'aliexpress',
      name: 'Elektronika - Best Sellers',
      enabled: true,
      filters: {
        searchQuery: 'electronics wireless',
        minPrice: 10,
        maxPrice: 500,
        minRating: 4.0,
        minOrders: 100,
        minDiscount: 20,
      },
      mapping: {
        targetMainCategory: 'elektronika',
        targetSubCategory: 'audio',
        defaultStatus: 'approved' as const,
      },
      deduplicationStrategy: 'skip' as const,
      maxItemsPerRun: 50,
      createdAt: new Date().toISOString(),
      createdBy: 'system',
    },
    {
      vendorId: 'aliexpress',
      name: 'Dom i Ogród - Hot Deals',
      enabled: true,
      filters: {
        searchQuery: 'home garden tools',
        minPrice: 5,
        maxPrice: 300,
        minRating: 4.5,
        minOrders: 50,
        minDiscount: 30,
      },
      mapping: {
        targetMainCategory: 'dom-i-ogrod',
        targetSubCategory: 'narzedzia',
        defaultStatus: 'approved' as const,
      },
      deduplicationStrategy: 'skip' as const,
      maxItemsPerRun: 30,
      createdAt: new Date().toISOString(),
      createdBy: 'system',
    },
    {
      vendorId: 'aliexpress',
      name: 'Sport - Fitness Equipment',
      enabled: false,
      filters: {
        searchQuery: 'fitness sports equipment',
        minPrice: 20,
        maxPrice: 1000,
        minRating: 4.0,
        minOrders: 200,
        minDiscount: 25,
      },
      mapping: {
        targetMainCategory: 'sport',
        targetSubCategory: 'fitness',
        defaultStatus: 'draft' as const,
      },
      deduplicationStrategy: 'skip' as const,
      maxItemsPerRun: 20,
      createdAt: new Date().toISOString(),
      createdBy: 'system',
    },
  ];

  for (const profile of profiles) {
    const existing = await adminDb
      .collection('importProfiles')
      .where('vendorId', '==', profile.vendorId)
      .where('name', '==', profile.name)
      .limit(1)
      .get();

    if (existing.empty) {
      const ref = await adminDb.collection('importProfiles').add(profile);
      console.log(`✓ Created profile: ${profile.name} (${ref.id})`);
    } else {
      console.log(`- Skipped (exists): ${profile.name}`);
    }
  }

  console.log('Seeding complete!');
  process.exit(0);
}

seedImportProfiles().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
