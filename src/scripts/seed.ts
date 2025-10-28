import * as admin from 'firebase-admin';
import * as serviceAccount from './serviceAccountKey.json';

// Inicjuj Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  databaseURL: 'okazje-plus.firebasestorage.app'
});

const db = admin.firestore();

// Przykładowe dane na bazie PDF(dodaj 2-3 docs per collection)
async function seedDatabase() {
  try {
    // Kolekcja: products
    const productsData = [
      {
        name: 'Przykładowy Produkt 1',
        description: 'Opis produktu 1 z Forge Verified.',
        mainImageUrl: 'https://example.com/image1.jpg',
        category: 'Elektronika',
        subcategory: 'Smartfony',
        affiliateUrl: 'https://aliexpress.com/affiliate1',
        price: 499.99,
        originalPrice: 599.99,
        isActive: true,
        commission: { rate: 5, incentiveRate: 2 },
        ratingCard: { durability: 4.5, valueForMoney: 4.8, easeOfUse: 4.2, versatility: 4.0 },
        verification: { status: 'tested', deliveryTimeDays: 7 }
      },
      {
        name: 'Przykładowy Produkt 2',
        description: 'Opis produktu 2 bez weryfikacji.',
        mainImageUrl: 'https://example.com/image2.jpg',
        category: 'Dom',
        subcategory: 'Oświetlenie',
        affiliateUrl: 'https://aliexpress.com/affiliate2',
        price: 99.99,
        originalPrice: 149.99,
        isActive: true,
        commission: { rate: 4, incentiveRate: 1 },
        ratingCard: { durability: 3.5, valueForMoney: 4.0, easeOfUse: 4.5, versatility: 3.8 },
        verification: { status: 'unverified', deliveryTimeDays: null }
      }
    ];

    for (const product of productsData) {
      const productRef = await db.collection('products').add(product);
      console.log(`Dodano product: ${productRef.id}`);

      // Subkolekcja: priceHistory (przykładowa historia cen)
      await db.collection(`products/${productRef.id}/priceHistory`).add({
        price: product.price,
        timestamp: admin.firestore.Timestamp.now()
      });

      // Subkolekcja: reviews (przykładowa recenzja)
      await db.collection(`products/${productRef.id}/reviews`).add({
        userId: 'testUser1',
        text: 'Świetny produkt!',
        rating: 4.5,
        createdAt: admin.firestore.Timestamp.now()
      });
    }

    // Kolekcja: deals
    const dealsData = [
      {
        title: 'Gorąca Okazja 1',
        imageUrl: 'https://example.com/deal1.jpg',
        authorId: 'testUser1',
        authorName: 'Test User',
        affiliateUrl: 'https://aliexpress.com/deal1',
        productUrl: 'https://aliexpress.com/product1',
        createdAt: admin.firestore.Timestamp.now(),
        startTime: admin.firestore.Timestamp.fromDate(new Date()),
        endTime: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 86400000)), // +1 dzień
        temperature: 50,
        suggestedTemperature: 60,
        isHot: true,
        status: 'approved',
        isActive: true,
        linkedProductId: null, // Lub ID z products
        promoCode: { code: 'PROMO10', minSpend: 100, discount: '10%', promotionUrl: 'https://promo.com', validFrom: admin.firestore.Timestamp.now(), validUntil: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 86400000)) }
      },
      {
        title: 'Gorąca Okazja 2',
        imageUrl: 'https://example.com/deal2.jpg',
        authorId: 'testUser2',
        authorName: 'Admin User',
        affiliateUrl: 'https://aliexpress.com/deal2',
        productUrl: 'https://aliexpress.com/product2',
        createdAt: admin.firestore.Timestamp.now(),
        startTime: admin.firestore.Timestamp.fromDate(new Date()),
        endTime: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 172800000)), // +2 dni
        temperature: 30,
        suggestedTemperature: 40,
        isHot: false,
        status: 'pending',
        isActive: true,
        linkedProductId: null,
        promoCode: null
      }
    ];

    for (const deal of dealsData) {
      const dealRef = await db.collection('deals').add(deal);
      console.log(`Dodano deal: ${dealRef.id}`);

      // Subkolekcja: comments
      await db.collection(`deals/${dealRef.id}/comments`).add({
        userId: 'testUser1',
        text: 'Super okazja!',
        createdAt: admin.firestore.Timestamp.now()
      });
    }

    // Kolekcja: users
    const usersData = [
      {
        role: 'user',
        points: 100,
        totalTemperature: 50
      },
      {
        role: 'admin',
        points: 500,
        totalTemperature: 200
      },
      {
        role: 'super-admin',
        points: 1000,
        totalTemperature: 500
      }
    ];

    for (const user of usersData) {
      const userRef = await db.collection('users').add(user); // UID to ID dok, jak w PDF
      console.log(`Dodano user: ${userRef.id}`);
    }

    console.log('Seed zakończony sukcesem!');
  } catch (error) {
    console.error('Błąd seed: ', error);
  }
}

seedDatabase();
