
import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

console.log('Attempting to initialize Firebase Admin SDK...');

try {
  // Check if the required environment variables are loaded
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    throw new Error('Missing required Firebase environment variables. Please check your .env.local file.');
  }

  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    // Replace the escaped newlines from the .env file with actual newlines
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\n/g, '\n'),
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  console.log('Firebase Admin SDK initialized successfully.');

  type CategorySeed = {
    id: string;
    name: string;
    sortOrder: number;
    description: string;
    icon?: string;
    accentColor?: string;
    heroImage?: string;
    promo?: {
      title: string;
      subtitle?: string;
      description?: string;
      image?: string;
      link?: string;
      cta?: string;
      badge?: string;
      color?: string;
    };
    subcategories: Array<{
      id: string;
      name: string;
      slug: string;
      sortOrder: number;
      description: string;
      icon?: string;
      image?: string;
      highlight?: boolean;
    }>;
  };

  // Example taxonomy for initial navigation experience
  const categoriesSeed: CategorySeed[] = [
    {
      id: 'elektronika',
      name: 'Elektronika',
      sortOrder: 10,
      description: 'Smart sprzęt, audio, foto i akcesoria.',
      icon: '💡',
      accentColor: '#2563EB',
      heroImage: 'https://images.unsplash.com/photo-1510554310702-221476a1b1b1?auto=format&fit=crop&w=960&q=80',
      promo: {
        title: 'Strefa Apple',
        subtitle: 'Najlepsze ceny sezonu',
        description: 'Odblokuj dodatkowe rabaty na MacBooki i iPhone’y. Tylko do końca tygodnia.',
        image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=900&q=80',
        link: '/deals',
        cta: 'Sprawdź promocje',
        badge: '🔥 Gorące',
        color: '#1D4ED8',
      },
      subcategories: [
        {
          id: 'smartfony',
          name: 'Smartfony',
          slug: 'smartfony',
          sortOrder: 10,
          description: 'Telefony, etui, akcesoria.',
          image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=600&q=80',
          highlight: true,
        },
        {
          id: 'laptopy',
          name: 'Laptopy',
          slug: 'laptopy',
          sortOrder: 20,
          description: 'Notebooki, ultrabooki, akcesoria.',
          image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80',
        },
        {
          id: 'audio',
          name: 'Audio',
          slug: 'audio',
          sortOrder: 30,
          description: 'Słuchawki, głośniki, soundbary.',
          image: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      id: 'dom-i-ogrod',
      name: 'Dom i ogród',
      sortOrder: 20,
      description: 'Wyposażenie, AGD i wszystko co potrzebne w domu.',
      icon: '🏡',
      accentColor: '#16A34A',
      heroImage: 'https://images.unsplash.com/photo-1449247666642-264389f5f5b1?auto=format&fit=crop&w=960&q=80',
      promo: {
        title: 'Weekend z darmową dostawą',
        subtitle: 'Tylko dla kategorii Dom i ogród',
        description: 'Zamów dziś, a dostawa większych sprzętów będzie gratis.',
        image: 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=900&q=80',
        link: '/deals',
        cta: 'Przejdź do okazji',
        badge: 'Nowość',
        color: '#22C55E',
      },
      subcategories: [
        {
          id: 'agd',
          name: 'AGD',
          slug: 'agd',
          sortOrder: 10,
          description: 'Sprzęt kuchenny i małe AGD.',
          image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=80',
          highlight: true,
        },
        {
          id: 'smart-home',
          name: 'Smart Home',
          slug: 'smart-home',
          sortOrder: 20,
          description: 'Inteligentne oświetlenie i automatyka.',
          image: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=600&q=80',
        },
        {
          id: 'ogrod',
          name: 'Ogród',
          slug: 'ogrod',
          sortOrder: 30,
          description: 'Narzędzia i akcesoria ogrodowe.',
          image: 'https://images.unsplash.com/photo-1461280360983-bd93eaa5051b?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      id: 'gaming',
      name: 'Gaming',
      sortOrder: 30,
      description: 'Gry, konsole i akcesoria dla graczy.',
      icon: '🎮',
      accentColor: '#C026D3',
      heroImage: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=960&q=80',
      promo: {
        title: 'Strefa gracza Pro',
        subtitle: 'Ekskluzywne zestawy z rabatem',
        description: 'Klawiatury, myszy i monitory gamingowe w pakietach taniej nawet o 30%.',
        image: 'https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=900&q=80',
        link: '/deals',
        cta: 'Zobacz zestawy',
        badge: 'Ekskluzywne',
        color: '#9333EA',
      },
      subcategories: [
        {
          id: 'konsole',
          name: 'Konsole',
          slug: 'konsole',
          sortOrder: 10,
          description: 'PlayStation, Xbox, Nintendo.',
          image: 'https://images.unsplash.com/photo-1580314819259-1a7e2d81f2bf?auto=format&fit=crop&w=600&q=80',
          highlight: true,
        },
        {
          id: 'pc-gaming',
          name: 'PC Gaming',
          slug: 'pc-gaming',
          sortOrder: 20,
          description: 'Podzespoły, peryferia i akcesoria.',
          image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=600&q=80',
        },
        {
          id: 'gry',
          name: 'Gry',
          slug: 'gry',
          sortOrder: 30,
          description: 'Tytuły na każdą platformę.',
          image: 'https://images.unsplash.com/photo-1515974256631-34ac1347a87c?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
  ];

  async function seedTaxonomy() {
    const db = admin.firestore();

    for (const category of categoriesSeed) {
      const categoryRef = db.collection('categories').doc(category.id);
      await categoryRef.set(
        {
          name: category.name,
          slug: category.id,
          sortOrder: category.sortOrder,
          description: category.description,
          icon: category.icon,
          accentColor: category.accentColor,
          heroImage: category.heroImage,
          promo: category.promo,
          subcategories: category.subcategories.map((sub) => ({
            name: sub.name,
            slug: sub.slug,
            description: sub.description,
            sortOrder: sub.sortOrder,
            icon: sub.icon,
            image: sub.image,
            highlight: sub.highlight,
          })),
        },
        { merge: true }
      );

      for (const subcategory of category.subcategories) {
        const subRef = categoryRef.collection('subcategories').doc(subcategory.id ?? subcategory.slug);
        await subRef.set(
          {
            name: subcategory.name,
            slug: subcategory.slug,
            description: subcategory.description,
            sortOrder: subcategory.sortOrder,
            icon: subcategory.icon,
            image: subcategory.image,
            highlight: subcategory.highlight,
          },
          { merge: true }
        );
      }
    }

    await db.collection('settings').doc('navigationShowcase').set(
      {
        promotedType: 'deals',
        promotedIds: [],
        dealOfTheDayId: null,
      },
      { merge: true }
    );

    console.log('Categories, subcategories and navigation showcase seeded.');
  }

  seedTaxonomy()
    .then(() => {
      console.log('Seeding complete.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error seeding database:', error);
      process.exit(1);
    });

} catch (error) {
  console.error('Failed to initialize Firebase Admin SDK:', error);
  process.exit(1);
}
