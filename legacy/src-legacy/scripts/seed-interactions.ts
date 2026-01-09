/**
 * seed-interactions.ts
 * Uzupełniający skrypt do zasilania Firebase danymi interakcyjnymi:
 * - Utworzenie kont testowych (testuser, admin, poweruser) z custom claims
 * - Dodanie deals z komentarzami, głosami i temperature spójnymi
 * - Dodanie produktów z ratingami od użytkowników
 * - Dodanie notifications dla testów uprawnień
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

console.log('Initializing Firebase Admin SDK for interactions seeding...');

try {
  // Najpierw sprawdź Application Default Credentials (Firebase App Hosting)
  let initialized = false;
  const projectIdEnv = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: projectIdEnv,
    });
    console.log('✓ Using Application Default Credentials (Firebase App Hosting)');
    initialized = true;
  } catch (adcError) {
    console.log('ADC not available, trying environment variables...');
  }

  if (!initialized) {
    // Fallback: zmienne środowiskowe
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      const credentialData = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      };
      admin.initializeApp({
        credential: admin.credential.cert(credentialData),
        projectId: projectIdEnv,
      });
      console.log('✓ Using Firebase credentials from environment variables.');
      initialized = true;
    } else {
      throw new Error(
        'Missing Firebase credentials. Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in .env.local or use Application Default Credentials.'
      );
    }
  }

  admin.firestore().settings({ ignoreUndefinedProperties: true });
  console.log('Firebase Admin SDK initialized successfully.');

  const db = admin.firestore();
  const auth = admin.auth();

  // Definicje użytkowników testowych
  const testUsers = [
    {
      uid: 'testuser-uid',
      email: 'testuser@example.com',
      password: 'testpass123',
      displayName: 'Test User',
      claims: { role: 'user' },
    },
    {
      uid: 'admin-uid',
      email: 'admin@example.com',
      password: 'adminpass123',
      displayName: 'Admin User',
      claims: { role: 'admin' },
    },
    {
      uid: 'poweruser-uid',
      email: 'poweruser@example.com',
      password: 'powerpass123',
      displayName: 'Power User',
      claims: { role: 'user' },
    },
  ];

  async function createTestUsers() {
    console.log('\n📝 Creating Firestore user documents (assuming Auth users exist)...');
    console.log('⚠️  NOTE: Firebase Auth users must be created manually or via Firebase Console.');
    console.log('    Required accounts: testuser@example.com, admin@example.com, poweruser@example.com');
    
    for (const user of testUsers) {
      try {
        // Zapisz tylko dokument użytkownika w Firestore (bez Auth operations)
        await db.collection('users').doc(user.uid).set(
          {
            email: user.email,
            displayName: user.displayName,
            role: user.claims.role,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        console.log(`✓ Firestore user doc created: ${user.email} (${user.uid})`);
      } catch (error) {
        console.error(`✗ Error creating Firestore doc for ${user.email}:`, error);
      }
    }
    
    console.log('\n⚠️  MANUAL STEP REQUIRED:');
    console.log('   1. Go to Firebase Console → Authentication');
    console.log('   2. Create these users if they don\'t exist:');
    console.log('      - testuser@example.com (password: testpass123)');
    console.log('      - admin@example.com (password: adminpass123) + set custom claim role=admin');
    console.log('      - poweruser@example.com (password: powerpass123)');
    console.log('   3. For admin user, run in Firebase Console CLI or Functions:');
    console.log('      admin.auth().setCustomUserClaims("admin-uid", { role: "admin" })');
  }

  async function seedInteractiveDeals() {
    console.log('\n🔥 Creating deals with temperature, votes, and comments...');

    const dealsData = [
      {
        id: 'hot-deal-1',
        title: { pl: 'iPhone 15 Pro - rewelacyjna cena!', en: 'iPhone 15 Pro - amazing price!' },
        description: { pl: 'Najnowszy iPhone w super promocji. Limitowana ilość.', en: 'Latest iPhone on sale. Limited quantity.' },
        price: 4299,
        originalPrice: 5499,
        link: 'https://example.com/iphone-15-pro',
        dealUrl: 'https://example.com/iphone-15-pro',
        image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9',
        imageHint: 'iPhone 15 Pro',
        mainCategorySlug: 'elektronika',
        subCategorySlug: 'smartfony',
        postedBy: testUsers[0].uid,
        postedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        temperature: 280,
        voteCount: 28,
        commentsCount: 5,
        status: 'approved',
      },
      {
        id: 'hot-deal-2',
        title: { pl: 'MacBook Air M3 - fenomenalna oferta', en: 'MacBook Air M3 - phenomenal offer' },
        description: { pl: 'Nowy MacBook z chipem M3 w najlepszej cenie na rynku.', en: 'New MacBook with M3 chip at the best market price.' },
        price: 5499,
        originalPrice: 6999,
        link: 'https://example.com/macbook-air-m3',
        dealUrl: 'https://example.com/macbook-air-m3',
        image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8',
        imageHint: 'MacBook Air M3',
        mainCategorySlug: 'elektronika',
        subCategorySlug: 'laptopy',
        postedBy: testUsers[1].uid,
        postedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        temperature: 450,
        voteCount: 45,
        commentsCount: 8,
        status: 'approved',
      },
      {
        id: 'hot-deal-3',
        title: { pl: 'Sony WH-1000XM5 - najlepsze słuchawki', en: 'Sony WH-1000XM5 - best headphones' },
        description: { pl: 'Flagowe słuchawki z ANC w super cenie.', en: 'Flagship ANC headphones at a great price.' },
        price: 1199,
        originalPrice: 1699,
        link: 'https://example.com/sony-wh1000xm5',
        dealUrl: 'https://example.com/sony-wh1000xm5',
        image: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d',
        imageHint: 'Sony WH-1000XM5',
        mainCategorySlug: 'elektronika',
        subCategorySlug: 'audio',
        postedBy: testUsers[2].uid,
        postedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        temperature: 180,
        voteCount: 18,
        commentsCount: 3,
        status: 'approved',
      },
      {
        id: 'pending-deal-1',
        title: { pl: 'Test Deal - Pending Moderation', en: 'Test Deal - Pending Moderation' },
        description: { pl: 'Ten deal czeka na moderację.', en: 'This deal is awaiting moderation.' },
        price: 99,
        originalPrice: 199,
        link: 'https://example.com/pending-deal',
        dealUrl: 'https://example.com/pending-deal',
        image: 'https://placehold.co/600x400',
        imageHint: 'Pending deal',
        mainCategorySlug: 'elektronika',
        subCategorySlug: 'smartfony',
        postedBy: testUsers[2].uid,
        postedAt: new Date().toISOString(),
        temperature: 0,
        voteCount: 0,
        commentsCount: 0,
        status: 'pending',
      },
    ];

    for (const deal of dealsData) {
      await db.collection('deals').doc(deal.id).set(deal, { merge: true });
      console.log(`✓ Created deal: ${deal.title} (status: ${deal.status})`);
    }
  }

  async function seedComments() {
    console.log('\n💬 Adding comments to deals...');

    const commentsData = [
      // Hot deal 1 - komentarze
      {
        dealId: 'hot-deal-1',
        comments: [
          {
            id: 'comment-1-1',
            userId: testUsers[1].uid,
            userName: testUsers[1].displayName,
            text: 'Świetna cena! Właśnie zamówiłem.',
            createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
            likes: 5,
          },
          {
            id: 'comment-1-2',
            userId: testUsers[2].uid,
            userName: testUsers[2].displayName,
            text: 'Wyprzedane już :( Ktoś zdążył?',
            createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
            likes: 2,
          },
          {
            id: 'comment-1-3',
            userId: testUsers[0].uid,
            userName: testUsers[0].displayName,
            text: 'Ja złapałem, działa kod rabatowy IPHONE50',
            createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
            likes: 8,
          },
        ],
      },
      // Hot deal 2 - komentarze
      {
        dealId: 'hot-deal-2',
        comments: [
          {
            id: 'comment-2-1',
            userId: testUsers[0].uid,
            userName: testUsers[0].displayName,
            text: 'M3 to prawdziwa bestia, polecam!',
            createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
            likes: 12,
          },
          {
            id: 'comment-2-2',
            userId: testUsers[2].uid,
            userName: testUsers[2].displayName,
            text: 'Czekam na wersję z 16GB RAM',
            createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
            likes: 3,
          },
        ],
      },
      // Hot deal 3 - komentarze
      {
        dealId: 'hot-deal-3',
        comments: [
          {
            id: 'comment-3-1',
            userId: testUsers[1].uid,
            userName: testUsers[1].displayName,
            text: 'Mam XM4, czy warto upgrade?',
            createdAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
            likes: 4,
          },
        ],
      },
    ];

    for (const dealComments of commentsData) {
      for (const comment of dealComments.comments) {
        await db
          .collection('deals')
          .doc(dealComments.dealId)
          .collection('comments')
          .doc(comment.id)
          .set(comment);
        console.log(`  ✓ Added comment to ${dealComments.dealId}: "${comment.text.substring(0, 40)}..."`);
      }
    }
  }

  async function seedVotes() {
    console.log('\n👍 Adding votes to deals...');

    const votesData = [
      {
        dealId: 'hot-deal-1',
        votes: [
          { userId: testUsers[0].uid, value: 1 },
          { userId: testUsers[1].uid, value: 1 },
          { userId: testUsers[2].uid, value: 1 },
        ],
      },
      {
        dealId: 'hot-deal-2',
        votes: [
          { userId: testUsers[0].uid, value: 1 },
          { userId: testUsers[1].uid, value: 1 },
        ],
      },
      {
        dealId: 'hot-deal-3',
        votes: [{ userId: testUsers[2].uid, value: 1 }],
      },
    ];

    for (const dealVotes of votesData) {
      for (const vote of dealVotes.votes) {
        await db
          .collection('deals')
          .doc(dealVotes.dealId)
          .collection('votes')
          .doc(vote.userId)
          .set({
            value: vote.value,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        console.log(`  ✓ Added vote to ${dealVotes.dealId} from user ${vote.userId}`);
      }
    }
  }

  async function seedProducts() {
    console.log('\n🛍️ Creating products with ratings...');

    const productsData = [
      {
        id: 'product-iphone-15-pro',
        name: 'iPhone 15 Pro',
        description: 'Najnowszy iPhone z titanową obudową',
        longDescription:
          'iPhone 15 Pro wprowadza nowy poziom wydajności dzięki chipowi A17 Pro i rewolucyjnemu designowi z tytanu.',
        image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9',
        imageHint: 'iPhone 15 Pro',
        affiliateUrl: 'https://example.com/aff/iphone-15-pro',
        price: 5499,
        originalPrice: 6499,
        mainCategorySlug: 'elektronika',
        subCategorySlug: 'smartfony',
        status: 'approved',
        ratingCard: {
          average: 4.7,
          count: 24,
          durability: 4.8,
          easeOfUse: 4.9,
          valueForMoney: 4.3,
          versatility: 4.8,
        },
      },
      {
        id: 'product-macbook-air-m3',
        name: 'MacBook Air M3',
        description: 'Ultracienki i wydajny laptop',
        longDescription: 'MacBook Air z chipem M3 oferuje niesamowitą wydajność w eleganckiej, przenośnej formie.',
        image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8',
        imageHint: 'MacBook Air M3',
        affiliateUrl: 'https://example.com/aff/macbook-air-m3',
        price: 6999,
        originalPrice: 7999,
        mainCategorySlug: 'elektronika',
        subCategorySlug: 'laptopy',
        status: 'approved',
        ratingCard: {
          average: 4.9,
          count: 42,
          durability: 5.0,
          easeOfUse: 4.9,
          valueForMoney: 4.6,
          versatility: 4.9,
        },
      },
      {
        id: 'product-sony-wh1000xm5',
        name: 'Sony WH-1000XM5',
        description: 'Flagowe słuchawki z ANC',
        longDescription:
          'Sony WH-1000XM5 to absolutna czołówka słuchawek z aktywną redukcją szumów. Doskonały dźwięk i komfort.',
        image: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d',
        imageHint: 'Sony WH-1000XM5',
        affiliateUrl: 'https://example.com/aff/sony-wh1000xm5',
        price: 1699,
        originalPrice: 1999,
        mainCategorySlug: 'elektronika',
        subCategorySlug: 'audio',
        status: 'approved',
        ratingCard: {
          average: 4.8,
          count: 38,
          durability: 4.7,
          easeOfUse: 4.9,
          valueForMoney: 4.7,
          versatility: 4.8,
        },
      },
    ];

    for (const product of productsData) {
      await db.collection('products').doc(product.id).set(product, { merge: true });
      console.log(`✓ Created product: ${product.name} (avg rating: ${product.ratingCard.average})`);
    }
  }

  async function seedNotifications() {
    console.log('\n🔔 Creating notifications for permission tests...');

    const notificationsData = [
      {
        id: 'notif-1',
        userId: testUsers[0].uid,
        type: 'comment',
        title: 'Nowy komentarz',
        message: 'Ktoś skomentował Twój deal',
        dealId: 'hot-deal-1',
        read: false,
        createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'notif-2',
        userId: testUsers[0].uid,
        type: 'vote',
        title: '+1 głos!',
        message: 'Twój deal otrzymał pozytywny głos',
        dealId: 'hot-deal-1',
        read: true,
        createdAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
      },
    ];

    for (const notif of notificationsData) {
      await db.collection('notifications').doc(notif.id).set(notif);
      console.log(`  ✓ Created notification for user ${notif.userId}`);
    }
  }

  async function seedFavorites() {
    console.log('\n⭐ Creating favorites for permission tests...');

    const favoritesData = [
      {
        userId: testUsers[0].uid,
        dealId: 'hot-deal-2',
      },
      {
        userId: testUsers[1].uid,
        dealId: 'hot-deal-1',
      },
    ];

    for (const fav of favoritesData) {
      await db.collection('favorites').doc(`${fav.userId}_${fav.dealId}`).set({
        userId: fav.userId,
        dealId: fav.dealId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`  ✓ Created favorite: user ${fav.userId} → deal ${fav.dealId}`);
    }
  }

  async function runSeeding() {
    console.log('==================================================');
    console.log('🌱 Starting Interactive Data Seeding');
    console.log('==================================================');

    await createTestUsers();
    await seedInteractiveDeals();
    await seedComments();
    await seedVotes();
    await seedProducts();
    await seedNotifications();
    await seedFavorites();

    console.log('\n==================================================');
    console.log('✅ Interactive seeding complete!');
    console.log('==================================================');
    console.log('\n📊 Summary:');
    console.log('  - Test users: 3 (testuser, admin, poweruser)');
    console.log('  - Approved deals: 3 (with temperature & votes)');
    console.log('  - Pending deals: 1 (for moderation tests)');
    console.log('  - Comments: ~8 across deals');
    console.log('  - Products with ratings: 3');
    console.log('  - Notifications: 2');
    console.log('  - Favorites: 2');
    console.log('\n🔐 Test Credentials:');
    console.log('  testuser@example.com / testpass123');
    console.log('  admin@example.com / adminpass123');
    console.log('  poweruser@example.com / powerpass123');
  }

  runSeeding()
    .then(() => {
      console.log('\n✅ All done! Ready for testing.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Error during seeding:', error);
      process.exit(1);
    });
} catch (error) {
  console.error('Failed to initialize Firebase Admin SDK:', error);
  process.exit(1);
}
