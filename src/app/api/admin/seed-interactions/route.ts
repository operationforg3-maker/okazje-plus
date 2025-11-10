import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// Lazy initialization function
function initializeFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return admin.app(); // Already initialized
  }

  try {
    // Try env vars first (for App Hosting with proper credentials)
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/gm, '\n').replace(/^"(.*)"$/, '$1');

      return admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        }),
      });
    } else {
      // Try local service account file (for local development)
      try {
        const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
        const serviceAccountJson = fs.readFileSync(serviceAccountPath, 'utf8');
        const serviceAccount = JSON.parse(serviceAccountJson);
        return admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
      } catch (fileError) {
        // Fallback: Application Default Credentials (production)
        return admin.initializeApp({
          credential: admin.credential.applicationDefault(),
        });
      }
    }
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    throw error;
  }
}

// Test users configuration
const testUsers = [
  {
    uid: 'testuser-uid',
    email: 'testuser@example.com',
    password: 'testpass123',
    displayName: 'Test User',
    role: 'user',
  },
  {
    uid: 'admin-uid',
    email: 'admin@example.com',
    password: 'adminpass123',
    displayName: 'Admin User',
    role: 'admin',
  },
  {
    uid: 'poweruser-uid',
    email: 'poweruser@example.com',
    password: 'powerpass123',
    displayName: 'Power User',
    role: 'user',
  },
];

export async function POST(request: NextRequest) {
  try {
    // Initialize Firebase Admin
    initializeFirebaseAdmin();
    const db = admin.firestore();
    const auth = admin.auth();

    const results = {
      users: [] as any[],
      deals: [] as any[],
      comments: [] as any[],
      votes: [] as any[],
      products: [] as any[],
      notifications: [] as any[],
      favorites: [] as any[],
      errors: [] as any[],
    };

    console.log('🌱 Starting interactive data seeding...');

    // 1. Create Auth users with custom claims
    console.log('📝 Creating test users...');
    for (const user of testUsers) {
      try {
        // Try to create user
        let userRecord;
        try {
          userRecord = await auth.createUser({
            uid: user.uid,
            email: user.email,
            password: user.password,
            displayName: user.displayName,
          });
          results.users.push({ email: user.email, created: true });
          console.log(`✓ Created user: ${user.email}`);
        } catch (error: any) {
          if (error.code === 'auth/uid-already-exists' || error.code === 'auth/email-already-exists') {
            userRecord = await auth.getUserByEmail(user.email);
            results.users.push({ email: user.email, exists: true });
            console.log(`✓ User already exists: ${user.email}`);
          } else {
            throw error;
          }
        }

        // Set custom claims for admin
        if (user.role === 'admin') {
          await auth.setCustomUserClaims(userRecord.uid, { admin: true });
          console.log(`  → Admin claim set for ${user.email}`);
        }

        // Create Firestore user document
        await db
          .collection('users')
          .doc(user.email.split('@')[0])
          .set(
            {
              email: user.email,
              displayName: user.displayName,
              role: user.role,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        console.log(`  → Firestore doc created`);
      } catch (error: any) {
        results.errors.push({ operation: 'create-user', email: user.email, error: error.message });
        console.error(`✗ Error creating user ${user.email}:`, error.message);
      }
    }

    // 2. Create deals with temperature, votes, and comments
    console.log('🔥 Creating deals...');
    const dealsData = [
      {
        id: 'hot-deal-1',
        title: 'iPhone 15 Pro - super okazja! 🔥',
        description: 'iPhone 15 Pro 128GB w najlepszej cenie roku. Sprawdź zanim zniknie!',
        price: 3999,
        originalPrice: 5499,
        link: 'https://example.com/iphone-15-pro',
        dealUrl: 'https://example.com/iphone-15-pro',
        image: 'https://picsum.photos/seed/iphone15/600/400',
        imageHint: 'iPhone 15 Pro',
        postedBy: 'testuser',
        postedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        voteCount: 45,
        commentsCount: 8,
        mainCategorySlug: 'elektronika',
        subCategorySlug: 'smartfony',
        temperature: 450,
        status: 'approved',
      },
      {
        id: 'hot-deal-2',
        title: 'MacBook Air M3 - rekordowo tanio! ⚡',
        description: 'MacBook Air M3 13" w świetnej promocji. Wydajność na lata!',
        price: 4499,
        originalPrice: 5999,
        link: 'https://example.com/macbook-air-m3',
        dealUrl: 'https://example.com/macbook-air-m3',
        image: 'https://picsum.photos/seed/macbook/600/400',
        imageHint: 'MacBook Air M3',
        postedBy: 'poweruser',
        postedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        voteCount: 38,
        commentsCount: 5,
        mainCategorySlug: 'elektronika',
        subCategorySlug: 'laptopy',
        temperature: 380,
        status: 'approved',
      },
      {
        id: 'hot-deal-3',
        title: 'Sony WH-1000XM5 - najlepsze słuchawki NC! 🎧',
        description: 'Flagowe słuchawki z ANC w promocyjnej cenie. Dźwięk hi-res!',
        price: 1199,
        originalPrice: 1699,
        link: 'https://example.com/sony-wh1000xm5',
        dealUrl: 'https://example.com/sony-wh1000xm5',
        image: 'https://picsum.photos/seed/sony/600/400',
        imageHint: 'Sony WH-1000XM5',
        postedBy: 'admin',
        postedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        voteCount: 29,
        commentsCount: 4,
        mainCategorySlug: 'elektronika',
        subCategorySlug: 'audio',
        temperature: 290,
        status: 'approved',
      },
      {
        id: 'pending-deal-1',
        title: 'Test Deal - Pending',
        description: 'This deal is pending approval',
        price: 99,
        originalPrice: 199,
        link: 'https://example.com/pending',
        dealUrl: 'https://example.com/pending',
        image: 'https://picsum.photos/seed/pending/600/400',
        postedBy: 'testuser',
        postedAt: new Date().toISOString(),
        voteCount: 0,
        commentsCount: 0,
        mainCategorySlug: 'elektronika',
        subCategorySlug: 'smartfony',
        temperature: 0,
        status: 'pending',
      },
    ];

    for (const deal of dealsData) {
      try {
        await db.collection('deals').doc(deal.id).set(deal, { merge: true });
        results.deals.push(deal.id);
        console.log(`✓ Created deal: ${deal.title}`);
      } catch (error: any) {
        results.errors.push({ operation: 'create-deal', id: deal.id, error: error.message });
        console.error(`✗ Error creating deal ${deal.id}:`, error.message);
      }
    }

    // 3. Add comments to deals
    console.log('💬 Adding comments...');
    const commentsData = [
      {
        dealId: 'hot-deal-1',
        comments: [
          {
            id: 'comment-1',
            authorId: 'poweruser',
            authorName: 'Power User',
            text: 'Świetna cena! Właśnie zamówiłem 🎉',
            createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
            upvotes: 12,
            downvotes: 0,
          },
          {
            id: 'comment-2',
            authorId: 'admin',
            authorName: 'Admin User',
            text: 'Potwierdzone - oferta nadal aktywna! ✅',
            createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
            upvotes: 8,
            downvotes: 1,
          },
        ],
      },
      {
        dealId: 'hot-deal-2',
        comments: [
          {
            id: 'comment-3',
            authorId: 'testuser',
            authorName: 'Test User',
            text: 'Mam ten model - polecam! Bateria trzyma cały dzień.',
            createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            upvotes: 5,
            downvotes: 0,
          },
        ],
      },
      {
        dealId: 'hot-deal-3',
        comments: [
          {
            id: 'comment-4',
            authorId: 'poweruser',
            authorName: 'Power User',
            text: 'Najlepsze słuchawki jakie miałem. ANC rewelacja!',
            createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
            upvotes: 15,
            downvotes: 2,
          },
        ],
      },
    ];

    for (const dealComments of commentsData) {
      for (const comment of dealComments.comments) {
        try {
          await db
            .collection('deals')
            .doc(dealComments.dealId)
            .collection('comments')
            .doc(comment.id)
            .set(comment);
          results.comments.push(comment.id);
          console.log(`✓ Added comment to ${dealComments.dealId}`);
        } catch (error: any) {
          results.errors.push({
            operation: 'create-comment',
            dealId: dealComments.dealId,
            error: error.message,
          });
        }
      }
    }

    // 4. Add votes to deals
    console.log('👍 Adding votes...');
    const votesData = [
      {
        dealId: 'hot-deal-1',
        votes: [
          { userId: 'testuser', value: 1 },
          { userId: 'admin', value: 1 },
          { userId: 'poweruser', value: 1 },
        ],
      },
      {
        dealId: 'hot-deal-2',
        votes: [
          { userId: 'testuser', value: 1 },
          { userId: 'poweruser', value: 1 },
        ],
      },
      {
        dealId: 'hot-deal-3',
        votes: [{ userId: 'admin', value: 1 }],
      },
    ];

    for (const dealVotes of votesData) {
      for (const vote of dealVotes.votes) {
        try {
          await db
            .collection('deals')
            .doc(dealVotes.dealId)
            .collection('votes')
            .doc(vote.userId)
            .set({
              value: vote.value,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          results.votes.push({ dealId: dealVotes.dealId, userId: vote.userId });
          console.log(`✓ Added vote to ${dealVotes.dealId} from ${vote.userId}`);
        } catch (error: any) {
          results.errors.push({ operation: 'create-vote', dealId: dealVotes.dealId, error: error.message });
        }
      }
    }

    // 5. Create products with ratings
    console.log('🛍️ Creating products...');
    const productsData = [
      {
        id: 'product-iphone-15-pro',
        name: 'iPhone 15 Pro',
        description: 'Najnowszy flagowiec Apple z chipem A17 Pro',
        longDescription:
          'iPhone 15 Pro to najnowszy flagowiec Apple z rewolucyjnym chipem A17 Pro, aparatem 48MP i tytanową obudową. Wydajność na najwyższym poziomie.',
        image: 'https://picsum.photos/seed/product-iphone/600/400',
        affiliateUrl: 'https://example.com/aff/iphone-15-pro',
        price: 4499,
        originalPrice: 5499,
        mainCategorySlug: 'elektronika',
        subCategorySlug: 'smartfony',
        status: 'approved',
        ratingCard: {
          average: 4.7,
          count: 128,
          durability: 4.5,
          easeOfUse: 4.8,
          valueForMoney: 4.3,
          versatility: 4.9,
        },
      },
      {
        id: 'product-macbook-air-m3',
        name: 'MacBook Air M3',
        description: 'Ultracienki laptop z chipem M3',
        longDescription:
          'MacBook Air M3 to idealne połączenie mocy i mobilności. Chip M3 zapewnia niesamowitą wydajność przy długim czasie pracy na baterii.',
        image: 'https://picsum.photos/seed/product-macbook/600/400',
        affiliateUrl: 'https://example.com/aff/macbook-air-m3',
        price: 4999,
        originalPrice: 5999,
        mainCategorySlug: 'elektronika',
        subCategorySlug: 'laptopy',
        status: 'approved',
        ratingCard: {
          average: 4.9,
          count: 94,
          durability: 4.8,
          easeOfUse: 5.0,
          valueForMoney: 4.6,
          versatility: 4.9,
        },
      },
    ];

    for (const product of productsData) {
      try {
        await db.collection('products').doc(product.id).set(product, { merge: true });
        results.products.push(product.id);
        console.log(`✓ Created product: ${product.name}`);
      } catch (error: any) {
        results.errors.push({ operation: 'create-product', id: product.id, error: error.message });
      }
    }

    // 6. Create notifications
    console.log('🔔 Creating notifications...');
    const notificationsData = [
      {
        id: 'notif-1',
        userId: 'testuser',
        type: 'comment',
        title: 'Nowy komentarz',
        message: 'Admin skomentował Twoją okazję',
        read: false,
        createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        dealId: 'hot-deal-1',
      },
      {
        id: 'notif-2',
        userId: 'poweruser',
        type: 'vote',
        title: 'Twoja okazja jest gorąca! 🔥',
        message: 'Temperatura przekroczyła 100',
        read: false,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        dealId: 'hot-deal-2',
      },
    ];

    for (const notif of notificationsData) {
      try {
        await db.collection('notifications').doc(notif.id).set(notif);
        results.notifications.push(notif.id);
        console.log(`✓ Created notification for ${notif.userId}`);
      } catch (error: any) {
        results.errors.push({ operation: 'create-notification', id: notif.id, error: error.message });
      }
    }

    // 7. Create favorites
    console.log('⭐ Creating favorites...');
    const favoritesData = [
      { userId: 'testuser', dealId: 'hot-deal-2' },
      { userId: 'admin', dealId: 'hot-deal-1' },
    ];

    for (const fav of favoritesData) {
      try {
        await db
          .collection('favorites')
          .doc(`${fav.userId}_${fav.dealId}`)
          .set({
            userId: fav.userId,
            dealId: fav.dealId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        results.favorites.push(`${fav.userId}_${fav.dealId}`);
        console.log(`✓ Created favorite for ${fav.userId}`);
      } catch (error: any) {
        results.errors.push({
          operation: 'create-favorite',
          userId: fav.userId,
          dealId: fav.dealId,
          error: error.message,
        });
      }
    }

    console.log('✅ Seeding complete!');

    return NextResponse.json({
      success: true,
      message: 'Interactive data seeding completed',
      results,
      summary: {
        users: results.users.length,
        deals: results.deals.length,
        comments: results.comments.length,
        votes: results.votes.length,
        products: results.products.length,
        notifications: results.notifications.length,
        favorites: results.favorites.length,
        errors: results.errors.length,
      },
    });
  } catch (error: any) {
    console.error('Seeding error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
