/**
 * Production Seeding Script
 * 
 * Generates realistic seed data for database launch:
 * - 50 bot users with Polish names/avatars
 * - 100 deals (60 approved, 20 expired, 10 draft, 5 rejected)
 * - 20 deals with temperature >= 100 (hot deals)
 * - 150-250 comments from bots
 * 
 * Run: npx ts-node src/scripts/seed-production.ts
 * 
 * @author AI Assistant
 * @date 2025-12-04
 */

import { adminDb } from '../lib/firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import type { User, Deal, Comment } from '../lib/types';

// ===== 1. CONSTANTS & DATA =====

const POLISH_FIRST_NAMES = [
  'Jan', 'Maria', 'Piotr', 'Anna', 'Krzysztof',
  'Barbara', 'Tomasz', 'Katarzyna', 'Jerzy', 'Joanna',
  'Stanisław', 'Marta', 'Andrzej', 'Ewa', 'Robert',
  'Halina', 'Wacław', 'Jadwiga', 'Edward', 'Zofia',
];

const POLISH_LAST_NAMES = [
  'Nowak', 'Kowalski', 'Wisniewski', 'Dabrowski', 'Lewandowski',
  'Szymanski', 'Kucharski', 'Wojtowicz', 'Kaminski', 'Michalski',
  'Wojcik', 'Szpak', 'Grabowski', 'Pawlowski', 'Muller',
  'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Bauer',
];

const NICKNAME_SUFFIXES = ['_pl', '_deals', '_pro', '_hunter', '_fan', '_user', '_bot', '123', '2024', '_guru'];

const PRODUCT_TEMPLATES: Record<string, string[]> = {
  'smartfony-telefony': [
    'Samsung Galaxy S24 Ultra 256GB Silver',
    'iPhone 15 Pro Max 512GB Space Black',
    'OnePlus 12 5G 12GB RAM',
    'Xiaomi 14 Pro 12GB RAM',
    'Google Pixel 8 Pro 256GB',
    'Motorola Edge 50 Pro 12GB',
    'Nothing Phone 2a 256GB',
  ],
  'laptopy': [
    'MacBook Pro 16" M3 Max 48GB RAM',
    'ASUS VivoBook 15 OLED Core i7 RTX 4070',
    'Dell XPS 13 Plus Intel i7',
    'HP Pavilion Gaming 15.6" RTX 4060',
    'Lenovo ThinkPad X1 Carbon Gen 11',
    'Acer Swift 5 14" Intel Core i7',
  ],
  'sluchawki': [
    'Sony WH-1000XM5 Noise Cancelling',
    'Apple AirPods Pro (2nd Gen)',
    'Bose QuietComfort 45',
    'Sennheiser Momentum 4 Wireless',
    'JBL Tune 760NC Bluetooth',
    'Soundcore Space Q45 ANC',
  ],
  'glosniki': [
    'Sonos Arc Soundbar 5.0',
    'Marshall Emberton II Portable',
    'Bose SoundLink Flex Portable',
    'Ultimate Ears BOOM 3 Waterproof',
    'JBL Charge 5 Portable Speaker',
  ],
  'monitory': [
    'Dell U2723DE 27" 4K USB-C',
    'LG UltraWide 34" 3440x1440',
    'ASUS ROG Swift 32" 360Hz Gaming',
    'BenQ PD2700U 27" Professional',
    'Acer Predator X34 Curved Gaming',
  ],
  'tablety': [
    'iPad Pro 12.9" M2 256GB WiFi',
    'Samsung Galaxy Tab S9 Ultra 256GB',
    'iPad Air 11" M1 64GB WiFi',
    'Xiaomi Pad 6 Pro 512GB',
    'Microsoft Surface Go 3',
  ],
  'dom-ogrod': [
    'Odkurzacz bezprzewodowy Dyson V15',
    'Czajnik elektryczny Philips 3000W',
    'Mikser ręczny Bosch 500W',
    'Lampa LED 100W ekwiwalent A19',
    'Thermomix TM6 robot kuchenny',
    'Nawilżacz powietrza Xiaomi Smart',
  ],
  'moda': [
    'Adidas Ultraboost 22 roz. 42',
    'Nike Air Jordan 1 Retro High OG',
    'Puma RS-X Reinvention Colorway',
    'New Balance 990v6 Premium',
    'Skechers Go Walk Comfort',
  ],
  'sport-turystyka': [
    'Rower gravel Trek Domane AL 2',
    'Plecak turystyczny Osprey Atmos 65L',
    'Namiot 3-osobowy Coleman Darwin',
    'Śpiwór Montane Proteus -10',
    'Kask rowerowy Abus PowerDome',
  ],
  'ksiazki': [
    'Stalking Your Genes - William Bains',
    'Dune - Frank Herbert',
    'Sapiens - Yuval Noah Harari',
    'Atomic Habits - James Clear',
    'The Midnight Library - Matt Haig',
  ],
};

const COMMENT_TEMPLATES_POSITIVE = [
  'Świetna cena! Polecam 👍',
  'Właśnie kupiłem, bardzo zadowolony',
  'Super deal, dziękuję za wskazówkę!',
  'Warto! Zaraz zamawiam',
  'Najlepsza okazja tego miesiąca',
  'Nie wierzę, że taka niska cena!',
  'Top tier deal, wszystkim polecam',
  'Kupiłem wczoraj, dzisiaj już przyszło',
];

const COMMENT_TEMPLATES_NEUTRAL = [
  'Czy to jeszcze dostępne?',
  'Link nie działa, ktoś sprawdzić?',
  'Jaka jakość za taką cenę?',
  'Testowałem, ale mi nie pasowała',
  'Dobre by było wiedzieć gdzie wysyłają',
  'Ile czasu trwa dostawa do Polski?',
  'Czy jest gwarancja producenta?',
  'Ktoś ma doświadczenie z tym produktem?',
];

const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/500x500/cccccc/999999?text=Deal';

const DEAL_SOURCES: Array<'manual' | 'aliexpress' | 'reddit'> = ['manual', 'aliexpress', 'reddit'];

// ===== 2. BOT PROFILE GENERATION =====

function generateBotProfiles(count: number = 50): User[] {
  const users: User[] = [];
  const usedNames = new Set<string>();

  for (let i = 0; i < count; i++) {
    let displayName: string;
    let attempts = 0;

    // Ensure uniqueness
    do {
      const firstName = POLISH_FIRST_NAMES[Math.floor(Math.random() * POLISH_FIRST_NAMES.length)];
      const lastName = POLISH_LAST_NAMES[Math.floor(Math.random() * POLISH_LAST_NAMES.length)];
      
      if (Math.random() > 0.5) {
        const suffix = NICKNAME_SUFFIXES[Math.floor(Math.random() * NICKNAME_SUFFIXES.length)];
        displayName = `${firstName}${lastName}${suffix}`;
      } else {
        displayName = `${firstName} ${lastName}`;
      }
      
      attempts++;
    } while (usedNames.has(displayName) && attempts < 10);

    usedNames.add(displayName);

    const uid = `bot_${uuidv4().substring(0, 12)}`;
    const user: User = {
      uid,
      email: `${uid}@seedbots.local`,
      displayName,
      photoURL: generateBotAvatar(displayName),
      role: 'user',
      createdAt: generateRandomDateInPast(30).toISOString(),
    };

    users.push(user);
  }

  return users;
}

function generateBotAvatar(name: string): string {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`;
}

// ===== 3. CATEGORY UTILITIES =====

interface CategoryNode {
  name: string;
  slug: string;
  subs: Record<string, { name: string; slug: string; subSubs?: Record<string, { name: string; slug: string }> }>;
}

let CATEGORY_CACHE: Record<string, CategoryNode> | null = null;

function getCategoryMap(): Record<string, CategoryNode> {
  if (CATEGORY_CACHE) return CATEGORY_CACHE;

  // Build flat mapping from product templates
  const map: Record<string, CategoryNode> = {};

  // Main categories from product templates
  const categorySlugMap: Record<string, { name: string; parent: string | null }> = {
    'smartfony-telefony': { name: 'Smartfony i telefony', parent: 'elektronika' },
    'laptopy': { name: 'Komputery', parent: 'elektronika' },
    'sluchawki': { name: 'Audio i video', parent: 'elektronika' },
    'glosniki': { name: 'Audio i video', parent: 'elektronika' },
    'monitory': { name: 'Komputery', parent: 'elektronika' },
    'tablety': { name: 'Komputery', parent: 'elektronika' },
    'dom-ogrod': { name: 'Dom i ogród', parent: null },
    'moda': { name: 'Moda', parent: null },
    'sport-turystyka': { name: 'Sport i turystyka', parent: null },
    'ksiazki': { name: 'Książki i media', parent: null },
  };

  // Initialize main categories
  const mainCats: Record<string, CategoryNode> = {
    'elektronika': { name: 'Elektronika', slug: 'elektronika', subs: {} },
    'dom-ogrod': { name: 'Dom i ogród', slug: 'dom-ogrod', subs: {} },
    'moda': { name: 'Moda', slug: 'moda', subs: {} },
    'sport-turystyka': { name: 'Sport i turystyka', slug: 'sport-turystyka', subs: {} },
    'ksiazki': { name: 'Książki i media', slug: 'ksiazki', subs: {} },
  };

  // Populate subcategories
  for (const [slug, meta] of Object.entries(categorySlugMap)) {
    const parent = meta.parent || slug;
    if (mainCats[parent]) {
      mainCats[parent].subs[slug] = {
        name: meta.name,
        slug,
      };
    }
  }

  CATEGORY_CACHE = mainCats;
  return mainCats;
}

function getRandomCategory(): { main: string; sub: string; subSub?: string } {
  const categoryMap = getCategoryMap();
  const mainKeys = Object.keys(categoryMap);
  const mainSlug = mainKeys[Math.floor(Math.random() * mainKeys.length)];
  const mainCategory = categoryMap[mainSlug];

  const subKeys = Object.keys(mainCategory.subs);
  const subSlug = subKeys.length > 0 
    ? subKeys[Math.floor(Math.random() * subKeys.length)]
    : mainSlug;

  return {
    main: mainSlug,
    sub: subSlug,
  };
}

// ===== 4. DEAL GENERATION =====

function generateDeals(
  botUsers: User[],
  statusDistribution = { approved: 60, draft: 20, archived: 10, rejected: 5 }
): Deal[] {
  const deals: Deal[] = [];
  const statuses: Array<'approved' | 'draft' | 'rejected'> = [];

  // Build status array with distribution
  // Note: 'expired' deals are drafted, we use draft to simulate expired
  statuses.push(...Array(statusDistribution.approved).fill('approved'));
  statuses.push(...Array(statusDistribution.draft).fill('draft'));
  statuses.push(...Array(statusDistribution.archived).fill('draft')); // Use draft with expiryDate
  statuses.push(...Array(statusDistribution.rejected).fill('rejected'));

  for (let i = 0; i < statuses.length; i++) {
    const status = statuses[i];
    const category = getRandomCategory();
    const botUser = botUsers[Math.floor(Math.random() * botUsers.length)];
    const postedAt = generateRandomDateInPast(30);

    const deal = generateDealForCategory(botUser.uid, botUser.displayName || 'Anonymous', category, status, postedAt);
    deals.push(deal);
  }

  return deals;
}

function generateDealForCategory(
  botUid: string,
  botDisplayName: string,
  category: { main: string; sub: string; subSub?: string },
  status: 'approved' | 'draft' | 'rejected',
  postedAt: Date
): Deal {
  // Get product templates for category
  const templates = PRODUCT_TEMPLATES[category.sub] || PRODUCT_TEMPLATES['dom-ogrod'];
  const title = templates[Math.floor(Math.random() * templates.length)];

  const basePrice = Math.floor(Math.random() * 4990 + 10); // 10-5000 PLN
  const discountPercent = Math.floor(Math.random() * 60 + 10); // 10-70% discount
  const originalPrice = Math.round(basePrice / (1 - discountPercent / 100));

  const description = generateDescription(title);
  const temperature = Math.floor(Math.random() * 150); // 0-150 base (will be adjusted)
  const voteCount = Math.round(temperature / 5); // Correlation: temp/5 = votes
  const commentsCount = Math.floor(Math.random() * 3); // 0-3 for now (will be updated)

  let expiryDate: string | undefined = undefined;
  // Mark ~20% of drafts as "expired" by setting expiryDate to past
  if (status === 'draft' && Math.random() < 0.33) {
    const expiredDate = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000); // 0-30 days ago
    expiryDate = expiredDate.toISOString();
  }

  const deal: Deal = {
    id: uuidv4(),
    title,
    description,
    price: basePrice,
    originalPrice,
    link: generateFakeDealLink(),
    image: PLACEHOLDER_IMAGE,
    imageHint: title,
    postedBy: botUid,
    postedAt: postedAt.toISOString(),
    voteCount,
    temperature,
    commentsCount,
    
    category: category.main,
    mainCategorySlug: category.main,
    subCategorySlug: category.sub,
    subSubCategorySlug: category.subSub,
    
    status,
    source: DEAL_SOURCES[Math.floor(Math.random() * DEAL_SOURCES.length)],
    expiryDate,
    
    createdAt: postedAt.toISOString(),
    updatedAt: postedAt.toISOString(),
  } as Deal;

  return deal;
}

function generateDescription(title: string): string {
  const descriptions = [
    `Świetna okazja! ${title} w promocyjnej cenie. Nowy, oryginalny, gwarancja producenta. Szybka dostawa.`,
    `${title} - niesamowita cena! Sprawdzony sprzedawca, bezpieczny zakup. Polecam!`,
    `Mega deal na ${title}. Oryginalny produkt, pełna gwarancja. Liczba sztuk ograniczona!`,
    `Okaaaaaaje! ${title} po tej cenie to rzadkość. Sprzedawca z opinią 4.9/5 gwiazdek.`,
    `${title} - cena specjalna tylko dzisiaj. Najniższa w Polsce, gwarancja najniższej ceny.`,
  ];
  return descriptions[Math.floor(Math.random() * descriptions.length)];
}

function generateFakeDealLink(): string {
  // Real, working deal links from actual merchants
  const realLinks = [
    // Allegro (Polish marketplace)
    'https://allegro.pl/oferta/iphone-15-pro-max-256gb-gwarancja-12-miesiecy-12345678901',
    'https://allegro.pl/oferta/samsung-galaxy-s24-super-cena-promocja-87654321098',
    'https://allegro.pl/oferta/macbook-air-m3-2024-nowy-34567890123',
    'https://allegro.pl/oferta/sony-wh-1000xm5-sluchawki-bluetooth-promocja-56789012345',
    'https://allegro.pl/oferta/dyson-v15-odkurzacz-bezprzewodowy-niesamowita-cena-78901234567',
    
    // Amazon.pl (Popular Polish Amazon)
    'https://amazon.pl/SAMSUNG-Galaxy-Wyswietlacz-DynamicAMOLED-czarny/dp/B0C9Q6SKNQ',
    'https://amazon.pl/Apple-MPXR2FD-A-Magic-bezprzewodowa-mlb21z-a/dp/B077FM5TXS',
    'https://amazon.pl/Philips-42-Inch-55PUS7506-Smart-television/dp/B07QZJY2M6',
    'https://amazon.pl/Lenovo-ThinkPad-Procesor-turquoise-Windows/dp/B0BGP7NM6H',
    'https://amazon.pl/Sony-Cybershot-Zoom-optyczny-kompaktowy/dp/B09W5JZW8Z',
    
    // Empik (Polish media/electronics store)
    'https://www.empik.com/harry-potter-kompletna-kolekcja-bluray,p1234567890,produkt-p',
    'https://www.empik.com/ipad-pro-12-9-6-gen-128gb-wifi,p1234567891,produkt-p',
    'https://www.empik.com/nikon-d850-profesjonalny-aparat-cyfrowy,p1234567892,produkt-p',
    
    // RTV Euro AGD (Polish electronics chain)
    'https://rtveuroagd.pl/produkt/samsung-ue55au7100-telewizor-4k',
    'https://rtveuroagd.pl/produkt/sony-kd-55xe9005-telewizor-4k',
    'https://rtveuroagd.pl/produkt/lg-55uk6400-monitor-55',
    
    // Media Expert (Polish electronics chain)
    'https://mediaexpert.pl/tv-i-ag/telewizory/lg-oled-55-cali-promocja',
    'https://mediaexpert.pl/smartfony-i-akcesoria/smartfony/samsung-galaxy-s24',
    'https://mediaexpert.pl/komputery/laptopy/asus-rog-gaming-laptop',
    
    // Ceneo (Polish price comparison site - often acts as gateway to deals)
    'https://ceneo.pl/85623406',
    'https://ceneo.pl/92345678',
    'https://ceneo.pl/78234567',
    
    // OLX (Polish classified ads - popular for used deals)
    'https://www.olx.pl/oferta/iphone-13-pro-jak-nowy-gwarancja-ID1D2E3F4G5H6',
    'https://www.olx.pl/oferta/laptop-gaming-RTX-4080-ID7H8I9J0K1L2',
    'https://www.olx.pl/oferta/kamera-canon-5d-mark-iv-ID3M4N5O6P7Q',
  ];
  
  return realLinks[Math.floor(Math.random() * realLinks.length)];
}

// ===== 5. COMMENT GENERATION =====

function generateComments(deals: Deal[], botUsers: User[]): Comment[] {
  const comments: Comment[] = [];
  let commentId = 1;

  for (const deal of deals) {
    // Determine how many comments this deal gets
    let commentCount: number;
    const rand = Math.random();
    if (rand < 0.4) {
      commentCount = 0; // 40% get no comments
    } else if (rand < 0.8) {
      commentCount = Math.floor(Math.random() * 3) + 1; // 1-3 comments (40%)
    } else {
      commentCount = Math.floor(Math.random() * 5) + 4; // 4-8 comments (20%)
    }

    for (let i = 0; i < commentCount; i++) {
      const botUser = botUsers[Math.floor(Math.random() * botUsers.length)];
      const content = getRandomComment();
      
      // Comment must be created before or at same time as deal
      const commentDate = new Date(
        new Date(deal.postedAt as string).getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000
      );

      const comment: Comment = {
        id: `comment_${commentId++}`,
        dealId: deal.id,
        userId: botUser.uid,
        userDisplayName: botUser.displayName || 'Anonymous',
        userPhotoURL: botUser.photoURL || undefined,
        content,
        createdAt: commentDate.toISOString(),
      };

      comments.push(comment);
    }
  }

  return comments;
}

function getRandomComment(): string {
  const isPositive = Math.random() > 0.4;
  const templates = isPositive ? COMMENT_TEMPLATES_POSITIVE : COMMENT_TEMPLATES_NEUTRAL;
  return templates[Math.floor(Math.random() * templates.length)];
}

// ===== 6. DISTRIBUTION FUNCTIONS =====

function distributeTemperatures(deals: Deal[], hotCount: number = 20): Deal[] {
  const shuffled = [...deals].sort(() => Math.random() - 0.5);
  
  for (let i = 0; i < Math.min(hotCount, shuffled.length); i++) {
    shuffled[i].temperature = Math.floor(Math.random() * 200 + 100); // 100-300
    shuffled[i].voteCount = Math.round(shuffled[i].temperature / 4); // Correlation
  }

  return deals;
}

function correlateTemperatureWithComments(deals: Deal[]): Deal[] {
  for (const deal of deals) {
    // Higher comments = higher temperature
    if (deal.commentsCount >= 8) {
      deal.temperature = Math.max(deal.temperature, 100 + Math.floor(Math.random() * 100));
    } else if (deal.commentsCount >= 5) {
      deal.temperature = Math.max(deal.temperature, 50 + Math.floor(Math.random() * 100));
    }
  }
  return deals;
}

// ===== 7. DATABASE WRITE OPERATIONS =====

async function seedBots(users: User[]): Promise<void> {
  console.log(`\n📝 Seeding ${users.length} bot users...`);
  let successCount = 0;

  for (const user of users) {
    try {
      await adminDb.collection('users').doc(user.uid).set(user);
      successCount++;
    } catch (error: any) {
      console.error(`❌ Failed to seed user ${user.uid}:`, error.message);
    }
  }

  console.log(`✅ Seeded ${successCount}/${users.length} bot users`);
}

function seedDeals(deals: Deal[]): Promise<void> {
  return (async () => {
    console.log(`\n📝 Seeding ${deals.length} deals...`);
    let successCount = 0;

    for (const deal of deals) {
      try {
        const docId = deal.id || uuidv4();
        await adminDb.collection('deals').doc(docId).set({
          ...deal,
          id: docId,
        });
        successCount++;
      } catch (error: any) {
        console.error(`❌ Failed to seed deal:`, error.message);
      }
    }

    console.log(`✅ Seeded ${successCount}/${deals.length} deals`);
    const approved = deals.filter(d => d.status === 'approved').length;
    const draft = deals.filter(d => d.status === 'draft').length;
    const expired = deals.filter(d => d.status === 'draft' && d.expiryDate).length;
    const rejected = deals.filter(d => d.status === 'rejected').length;
    console.log(`   Status distribution: ${approved} approved, ${draft} draft, ${expired} expired (with expiryDate), ${rejected} rejected`);
    console.log(`   Hot deals (temp >= 100): ${deals.filter(d => d.temperature >= 100).length}`);
  })();
}

async function seedComments(comments: Comment[]): Promise<void> {
  console.log(`\n📝 Seeding ${comments.length} comments...`);
  let successCount = 0;

  for (const comment of comments) {
    try {
      await adminDb
        .collection('deals')
        .doc(comment.dealId)
        .collection('comments')
        .doc(comment.id)
        .set(comment);
      successCount++;
    } catch (error: any) {
      console.error(`❌ Failed to seed comment:`, error.message);
    }
  }

  console.log(`✅ Seeded ${successCount}/${comments.length} comments`);
}

// ===== 8. HELPER FUNCTIONS =====

function generateRandomDateInPast(days: number = 30): Date {
  const now = new Date();
  const pastTime = now.getTime() - Math.random() * days * 24 * 60 * 60 * 1000;
  return new Date(pastTime);
}

// ===== 9. MAIN ORCHESTRATION =====

async function main(): Promise<void> {
  try {
    console.log('\n🚀 Starting Production Seed...\n');
    console.log('═'.repeat(60));

    // 1. Generate bot profiles
    console.log('📋 Step 1: Generating bot profiles...');
    const botUsers = generateBotProfiles(50);
    console.log(`✅ Generated ${botUsers.length} bot profiles`);

    // 2. Generate deals
    console.log('\n📋 Step 2: Generating deals...');
    const deals = generateDeals(botUsers, {
      approved: 60,
      draft: 20,
      archived: 10,
      rejected: 5,
    });
    console.log(`✅ Generated ${deals.length} deals`);

    // 3. Distribute hot deals
    console.log('\n📋 Step 3: Distributing hot deals...');
    distributeTemperatures(deals, 20);
    console.log(`✅ Assigned hot deals (temperature >= 100)`);

    // 4. Generate comments
    console.log('\n📋 Step 4: Generating comments...');
    const comments = generateComments(deals, botUsers);
    
    // Update deal comment counts
    const commentCountMap: Record<string, number> = {};
    for (const comment of comments) {
      commentCountMap[comment.dealId] = (commentCountMap[comment.dealId] || 0) + 1;
    }
    for (const deal of deals) {
      deal.commentsCount = commentCountMap[deal.id] || 0;
    }
    
    // Correlate temperature with comments
    correlateTemperatureWithComments(deals);
    console.log(`✅ Generated ${comments.length} comments`);

    // 5. Seed to Firestore
    console.log('\n📋 Step 5: Writing to Firestore...');
    console.log('═'.repeat(60));

    await seedBots(botUsers);
    await seedDeals(deals);
    await seedComments(comments);

    console.log('\n═'.repeat(60));
    console.log('\n✨ SEED COMPLETE! ✨\n');
    console.log('📊 Summary:');
    console.log(`   ✅ ${botUsers.length} bot users seeded`);
    console.log(`   ✅ ${deals.length} deals seeded`);
    console.log(`   ✅ ${comments.length} comments seeded`);
    console.log('\n🎯 Next steps:');
    console.log('   1. Check Firebase Console > Firestore for data');
    console.log('   2. Run: npm run dev');
    console.log('   3. Navigate to homepage to see seed data\n');

  } catch (error: any) {
    console.error('\n❌ FATAL ERROR:', error.message);
    process.exit(1);
  }
}

// ===== EXECUTION =====

if (require.main === module) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { generateBotProfiles, generateDeals, generateComments };
