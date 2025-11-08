
import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

console.log('Attempting to initialize Firebase Admin SDK...');

try {
  // Check if the required environment variables are loaded
  let credentialData: any = null;
  const projectIdEnv = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    credentialData = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
    console.log('Using Firebase credentials from environment variables.');
  } else {
    try {
      // Fallback: attempt to load local service account JSON
      // IMPORTANT: Ensure this file is NOT committed with real secrets in production.
      // Current file appears to be sanitized; if the private key contains comment markers they will be stripped.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const svc = require('./serviceAccountKey.json');
      if (!svc.project_id || !svc.client_email || !svc.private_key) {
        throw new Error('serviceAccountKey.json missing required fields');
      }
      // Sanitize private key (remove lines starting with // inside the key)
      const cleanedKey = (svc.private_key as string)
        .split('\n')
        .filter((l) => !l.trim().startsWith('//'))
        .join('\n');
      credentialData = {
        projectId: svc.project_id,
        clientEmail: svc.client_email,
        privateKey: cleanedKey,
      };
      console.log('Using Firebase credentials from serviceAccountKey.json fallback.');
    } catch (e) {
      // As a last resort, attempt Application Default Credentials (ADC)
      try {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          projectId: projectIdEnv,
        });
        console.log('Initialized with Application Default Credentials.');
      } catch (adcErr) {
        throw new Error('Missing required Firebase credentials (env vars, serviceAccountKey.json, or ADC). ' + adcErr + ' | Fallback error: ' + e);
      }
      // Skip the regular initialize below since we've initialized via ADC
      console.log('Firebase Admin SDK initialized with ADC.');
      console.log('Proceeding with seeding...');
      // Continue to seeding without returning, but prevent double-initialization
      credentialData = null;
    }
  }
  if (credentialData) {
    admin.initializeApp({
      credential: admin.credential.cert(credentialData),
      projectId: projectIdEnv,
    });
  }

  // Firestore: ignoruj pola undefined, aby nie przerywać zapisu przy opcjonalnych polach
  admin.firestore().settings({ ignoreUndefinedProperties: true });

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

  // Rozszerzona taksonomia: minimum 5 kategorii, każda 3-11 podkategorii
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
    {
      id: 'moda',
      name: 'Moda',
      sortOrder: 40,
      description: 'Styl, ubrania, obuwie i dodatki.',
      icon: '👗',
      accentColor: '#DB2777',
      heroImage: 'https://images.unsplash.com/photo-1521335629791-ce4aec67dd47?auto=format&fit=crop&w=960&q=80',
      promo: {
        title: 'Jesienna kolekcja',
        subtitle: 'Warstwowy styl na chłodne dni',
        description: 'Swetry, kurtki i dodatki w nowych kolorach sezonu.',
        image: 'https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?auto=format&fit=crop&w=900&q=80',
        link: '/deals',
        cta: 'Odkryj trendy',
        badge: 'Trend',
        color: '#BE185D',
      },
      subcategories: [
        {
          id: 'obuwie',
          name: 'Obuwie',
          slug: 'obuwie',
          sortOrder: 10,
          description: 'Buty sportowe, casual i eleganckie.',
          image: 'https://images.unsplash.com/photo-1519741491150-74f64f6d5d37?auto=format&fit=crop&w=600&q=80',
          highlight: true,
        },
        {
          id: 'odziez-meska',
          name: 'Odzież męska',
          slug: 'odziez-meska',
          sortOrder: 20,
          description: 'Klasyka i nowoczesność w męskich fasonach.',
          image: 'https://images.unsplash.com/photo-1520970019510-6a7b6c5f09f0?auto=format&fit=crop&w=600&q=80',
        },
        {
          id: 'odziez-damska',
          name: 'Odzież damska',
          slug: 'odziez-damska',
          sortOrder: 30,
          description: 'Kolekcje dla niej: elegancja i komfort.',
          image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=600&q=80',
        },
        {
          id: 'dodatki',
          name: 'Dodatki',
          slug: 'dodatki',
          sortOrder: 40,
          description: 'Torebki, paski, czapki i akcesoria.',
          image: 'https://images.unsplash.com/photo-1518544801958-efcbf8a7ec06?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
    {
      id: 'sport-i-turystyka',
      name: 'Sport i turystyka',
      sortOrder: 50,
      description: 'Sprzęt sportowy, outdoor i rekreacja.',
      icon: '🏃',
      accentColor: '#0D9488',
      heroImage: 'https://images.unsplash.com/photo-1526401485004-2aa7d4b5e3d5?auto=format&fit=crop&w=960&q=80',
      promo: {
        title: 'Pakiety outdoor',
        subtitle: 'Taniej w zestawach',
        description: 'Zestawy trekkingowe i fitness z rabatami do 25%.',
        image: 'https://images.unsplash.com/photo-1508175800960-180dd151d86d?auto=format&fit=crop&w=900&q=80',
        link: '/deals',
        cta: 'Zobacz pakiety',
        badge: 'Outdoor',
        color: '#0F766E',
      },
      subcategories: [
        {
          id: 'fitness',
          name: 'Fitness',
          slug: 'fitness',
          sortOrder: 10,
          description: 'Maty, hantle, akcesoria treningowe.',
          image: 'https://images.unsplash.com/photo-1558611848-73f7eb4001a2?auto=format&fit=crop&w=600&q=80',
          highlight: true,
        },
        {
          id: 'turystyka',
          name: 'Turystyka',
          slug: 'turystyka',
          sortOrder: 20,
          description: 'Plecaki, namioty, śpiwory.',
          image: 'https://images.unsplash.com/photo-1516570161787-2fd917215a3d?auto=format&fit=crop&w=600&q=80',
        },
        {
          id: 'sporty-zimowe',
          name: 'Sporty zimowe',
          slug: 'sporty-zimowe',
          sortOrder: 30,
          description: 'Narty, snowboard, odzież termiczna.',
          image: 'https://images.unsplash.com/photo-1517840901100-1a7ffb41d87e?auto=format&fit=crop&w=600&q=80',
        },
        {
          id: 'rowery',
          name: 'Rowery',
          slug: 'rowery',
          sortOrder: 40,
          description: 'Rowery górskie, miejskie i akcesoria.',
          image: 'https://images.unsplash.com/photo-1501706362039-c6e80967656f?auto=format&fit=crop&w=600&q=80',
        },
        {
          id: 'sporty-wodne',
          name: 'Sporty wodne',
          slug: 'sporty-wodne',
          sortOrder: 50,
          description: 'Kajaki, SUP, akcesoria wodne.',
          image: 'https://images.unsplash.com/photo-1493558103817-58b2924bce98?auto=format&fit=crop&w=600&q=80',
        },
      ],
    },
  ];

  // Helpery generujące przykładowe produkty i okazje (deals)
  function randomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function generateProducts(mainCategory: string, subCategory: string, count: number) {
    const products = [] as any[];
    for (let i = 0; i < count; i++) {
      const id = `${subCategory}-prod-${i + 1}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const price = randomInt(49, 2499);
      const originalPrice = price + randomInt(10, 400);
      products.push({
        id,
        name: `${subCategory.replace(/-/g, ' ')} produkt ${i + 1}`,
        description: `Solidny produkt z kategorii ${subCategory}.`,
        longDescription: `Rozszerzony opis produktu ${i + 1} w subkategorii ${subCategory} należącej do kategorii ${mainCategory}. Zawiera kluczowe cechy i zastosowania w codziennym życiu użytkownika.`,
        image: `https://picsum.photos/seed/${encodeURIComponent(id)}/600/400`,
        imageHint: 'Produkt ilustracyjny',
        affiliateUrl: 'https://example.com/ref/' + id,
        ratingCard: {
          average: randomInt(35, 50) / 10, // 3.5 - 5.0
          count: randomInt(5, 120),
          durability: randomInt(30, 50) / 10, // 3.0 - 5.0
          easeOfUse: randomInt(30, 50) / 10, // 3.0 - 5.0
          valueForMoney: randomInt(30, 50) / 10, // 3.0 - 5.0
          versatility: randomInt(30, 50) / 10, // 3.0 - 5.0
        },
        price,
        mainCategorySlug: mainCategory,
        subCategorySlug: subCategory,
        status: 'approved',
        category: mainCategory, // kompatybilność ze starszym polem
        originalPrice,
      });
    }
    return products;
  }

  function generateDeals(mainCategory: string, subCategory: string, count: number) {
    const deals = [] as any[];
    for (let i = 0; i < count; i++) {
      const id = `${subCategory}-deal-${i + 1}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const price = randomInt(29, 1999);
      const originalPrice = price + randomInt(20, 600);
      const temperature = randomInt(10, 500);
      const voteCount = randomInt(1, Math.floor(temperature / 10)); // voteCount mniejszy niż temperatura
      deals.push({
        id,
        title: `Okazja: ${subCategory.replace(/-/g, ' ')} ${i + 1}`,
        description: `Promocyjna oferta w subkategorii ${subCategory}. Rabat względem ceny bazowej.`,
        price,
        originalPrice,
        link: 'https://example.com/deal/' + id,
        image: `https://placehold.co/600x400?text=${encodeURIComponent(subCategory)}+${i + 1}`,
        imageHint: 'Zdjęcie poglądowe',
        postedBy: 'system-seeder',
        postedAt: new Date(Date.now() - randomInt(0, 30) * 24 * 60 * 60 * 1000).toISOString(), // losowa data ostatnie 30 dni
        voteCount,
        commentsCount: 0,
        mainCategorySlug: mainCategory,
        subCategorySlug: subCategory,
        temperature,
        status: 'approved',
      });
    }
    return deals;
  }

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

        // Generowanie produktów i deals dla każdej subkategorii
        const productsCount = randomInt(2, 6);
        const dealsCount = randomInt(2, 6);
        const products = generateProducts(category.id, subcategory.slug, productsCount);
        const deals = generateDeals(category.id, subcategory.slug, dealsCount);

        for (const product of products) {
          await db.collection('products').doc(product.id).set(product, { merge: true });
        }
        for (const deal of deals) {
          await db.collection('deals').doc(deal.id).set(deal, { merge: true });
        }
        console.log(`Seeded ${productsCount} produktów i ${dealsCount} okazji dla subkategorii: ${subcategory.slug}`);
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

    console.log('Categories, subcategories, products, deals oraz navigation showcase seeded.');
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
