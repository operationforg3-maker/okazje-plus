import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { Badge, Marketplace, ReputationLevel } from '../lib/types';

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

/**
 * Sample badges for gamification
 */
const SAMPLE_BADGES: Omit<Badge, 'id'>[] = [
  {
    name: 'Pierwszy Krok',
    nameEn: 'First Step',
    description: 'Dodałeś swoją pierwszą okazję!',
    icon: '🎯',
    rarity: 'common',
    category: 'milestone',
    criteria: {
      type: 'deal_count',
      threshold: 1,
    },
    points: 50,
    color: '#60a5fa',
    sortOrder: 1,
  },
  {
    name: 'Łowca Okazji',
    nameEn: 'Deal Hunter',
    description: 'Dodałeś 10 zatwierdzonych okazji',
    icon: '🎪',
    rarity: 'uncommon',
    category: 'contribution',
    criteria: {
      type: 'deal_count',
      threshold: 10,
    },
    points: 100,
    color: '#8b5cf6',
    sortOrder: 2,
  },
  {
    name: 'Mistrz Recenzji',
    nameEn: 'Review Master',
    description: 'Napisałeś 25 pomocnych recenzji',
    icon: '✍️',
    rarity: 'rare',
    category: 'quality',
    criteria: {
      type: 'review_quality',
      threshold: 25,
    },
    points: 200,
    color: '#f59e0b',
    sortOrder: 3,
  },
  {
    name: 'Społecznik',
    nameEn: 'Community Member',
    description: 'Dodałeś 100 komentarzy',
    icon: '💬',
    rarity: 'uncommon',
    category: 'engagement',
    criteria: {
      type: 'comment_count',
      threshold: 100,
    },
    points: 150,
    color: '#10b981',
    sortOrder: 4,
  },
  {
    name: 'Orzeł Cen',
    nameEn: 'Price Eagle',
    description: 'Zgłosiłeś 5 błędów cenowych',
    icon: '🦅',
    rarity: 'rare',
    category: 'quality',
    criteria: {
      type: 'report_verified',
      threshold: 5,
    },
    points: 250,
    color: '#ef4444',
    sortOrder: 5,
  },
  {
    name: 'Konsekwentny',
    nameEn: 'Consistent',
    description: 'Aktywny przez 30 dni z rzędu',
    icon: '🔥',
    rarity: 'epic',
    category: 'engagement',
    criteria: {
      type: 'consecutive_days',
      threshold: 30,
    },
    points: 300,
    color: '#f97316',
    sortOrder: 6,
  },
  {
    name: 'Legenda',
    nameEn: 'Legend',
    description: 'Osiągnięto 5000 punktów',
    icon: '🏆',
    rarity: 'legendary',
    category: 'milestone',
    criteria: {
      type: 'total_points',
      threshold: 5000,
    },
    points: 500,
    color: '#eab308',
    sortOrder: 7,
  },
  {
    name: 'Wczesny Ptak',
    nameEn: 'Early Bird',
    description: 'Dodawaj okazje rano (6-9)',
    icon: '🐦',
    rarity: 'common',
    category: 'special',
    criteria: {
      type: 'time_based',
      threshold: 10,
    },
    points: 75,
    color: '#06b6d4',
    sortOrder: 8,
  },
  {
    name: 'Nocny Marek',
    nameEn: 'Night Owl',
    description: 'Aktywny po północy',
    icon: '🦉',
    rarity: 'common',
    category: 'special',
    criteria: {
      type: 'time_based',
      threshold: 10,
    },
    points: 75,
    color: '#6366f1',
    sortOrder: 9,
  },
  {
    name: 'Pomocna Dłoń',
    nameEn: 'Helping Hand',
    description: 'Twoje recenzje otrzymały 50 głosów "pomocne"',
    icon: '🤝',
    rarity: 'epic',
    category: 'quality',
    criteria: {
      type: 'helpful_votes',
      threshold: 50,
    },
    points: 350,
    color: '#ec4899',
    sortOrder: 10,
  },
];

/**
 * Sample marketplaces for multi-source integration
 */
const SAMPLE_MARKETPLACES: Omit<Marketplace, 'id' | 'createdAt'>[] = [
  {
    name: 'AliExpress',
    slug: 'aliexpress',
    country: 'CN',
    currency: 'PLN',
    enabled: true,
    logo: '/logos/aliexpress.png',
    color: '#ff4747',
    config: {
      apiEndpoint: 'https://api.aliexpress.com',
      rateLimitPerMinute: 60,
      supportsReviews: true,
      supportsPriceHistory: true,
      supportsTracking: true,
    },
    stats: {
      totalProducts: 0,
      totalDeals: 0,
      averageRating: 4.2,
    },
    updatedAt: new Date().toISOString(),
  },
  {
    name: 'Amazon',
    slug: 'amazon',
    country: 'US',
    currency: 'PLN',
    enabled: false, // Not yet integrated
    logo: '/logos/amazon.png',
    color: '#ff9900',
    config: {
      apiEndpoint: 'https://api.amazon.com',
      rateLimitPerMinute: 30,
      supportsReviews: true,
      supportsPriceHistory: true,
      supportsTracking: true,
    },
    stats: {
      totalProducts: 0,
      totalDeals: 0,
    },
    updatedAt: new Date().toISOString(),
  },
  {
    name: 'Allegro',
    slug: 'allegro',
    country: 'PL',
    currency: 'PLN',
    enabled: false, // Not yet integrated
    logo: '/logos/allegro.png',
    color: '#ff5a00',
    config: {
      apiEndpoint: 'https://api.allegro.pl',
      rateLimitPerMinute: 60,
      supportsReviews: true,
      supportsPriceHistory: false,
      supportsTracking: true,
    },
    stats: {
      totalProducts: 0,
      totalDeals: 0,
    },
    updatedAt: new Date().toISOString(),
  },
  {
    name: 'eBay',
    slug: 'ebay',
    country: 'US',
    currency: 'PLN',
    enabled: false, // Not yet integrated
    logo: '/logos/ebay.png',
    color: '#e53238',
    config: {
      apiEndpoint: 'https://api.ebay.com',
      rateLimitPerMinute: 50,
      supportsReviews: true,
      supportsPriceHistory: false,
      supportsTracking: true,
    },
    stats: {
      totalProducts: 0,
      totalDeals: 0,
    },
    updatedAt: new Date().toISOString(),
  },
];

async function seedM3Data() {
  console.log('🌱 Starting M3 data seeding...');

  try {
    // Seed badges
    console.log('📛 Seeding badges...');
    const badgesRef = db.collection('badges');
    for (const badge of SAMPLE_BADGES) {
      const badgeId = badge.nameEn.toLowerCase().replace(/\s+/g, '_');
      await badgesRef.doc(badgeId).set(badge);
      console.log(`  ✓ Created badge: ${badge.name}`);
    }
    console.log(`✅ Seeded ${SAMPLE_BADGES.length} badges`);

    // Seed marketplaces
    console.log('🏪 Seeding marketplaces...');
    const marketplacesRef = db.collection('marketplaces');
    for (const marketplace of SAMPLE_MARKETPLACES) {
      await marketplacesRef.doc(marketplace.slug).set({
        ...marketplace,
        createdAt: new Date().toISOString(),
      });
      console.log(`  ✓ Created marketplace: ${marketplace.name}`);
    }
    console.log(`✅ Seeded ${SAMPLE_MARKETPLACES.length} marketplaces`);

    console.log('✨ M3 data seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding M3 data:', error);
    throw error;
  }
}

// Run the seeding if this file is executed directly
if (require.main === module) {
  seedM3Data()
    .then(() => {
      console.log('Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { seedM3Data };
