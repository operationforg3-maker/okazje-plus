import { createDeal } from '@/lib/data';

/**
 * Pobiera deale (promocje) z AliExpress API dla każdej kategorii
 * i zapisuje je do Firestore jako Deal (source: 'aliexpress', status: 'draft')
 * 
 * UWAGA: Deale to agregowane oferty z AliExpress, NIE generowane sztucznie!
 * Szukamy produktów z dużymi zniżkami (>50%) lub promocjami.
 */
export async function fillCategoriesWithDeals() {
  // Kategorie do przeszukania promocji
  const dealCategories = [
    { name: 'Elektronika - Promocje Black Friday', slug: 'elektronika', query: 'electronics deals discount sale' },
    { name: 'Telefony - Wyprzedaż', slug: 'telefony-smartfony', query: 'smartphone sale discount coupon' },
    { name: 'Laptopy - Hot Deals', slug: 'laptopy-komputery', query: 'laptop deals promotion flash sale' },
    { name: 'Audio - Megaokazje', slug: 'audio-wideo', query: 'headphones speakers deals discount' },
    { name: 'Dom i Ogród - Promocje', slug: 'dom-ogrod', query: 'home garden appliances sale' },
    { name: 'AGD - Wyprzedaż', slug: 'agd', query: 'home appliances discount sale' },
    { name: 'Moda - Flash Sale', slug: 'moda', query: 'fashion clothing shoes sale discount' },
    { name: 'Sport - Hot Deals', slug: 'sport-turystyka', query: 'sports fitness deals promotion' },
    { name: 'Dziecko - Promocje', slug: 'dziecko', query: 'kids toys baby products sale' },
    { name: 'Supermarket - Okazje', slug: 'supermarket', query: 'food snacks household sale' }
  ];
  
  let totalDeals = 0;
  
  for (const category of dealCategories) {
    try {
      // Szukaj produktów z dużą zniżką (>50%) przez AliExpress API
      const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:9002'}/api/admin/aliexpress/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: category.query,
          limit: 10, // Po 10 deali na kategorię
          sort: 'orders', // Sortuj po popularności
          minDiscount: 50 // Minimum 50% zniżki - to są prawdziwe okazje!
        })
      });
      
      if (!response.ok) {
        console.warn(`Nie udało się pobrać deali dla ${category.name}`);
        continue;
      }
      
      const data = await response.json();
      const products = data.products || [];
      
      // Mapuj produkty z AliExpress na Deal type
      for (const product of products) {
        try {
          // Oblicz zniżkę
          const discount = product.originalPrice && product.price 
            ? Math.round((1 - product.price / product.originalPrice) * 100)
            : 0;
            
          // Tylko produkty z realną zniżką >= 50%
          if (discount < 50) continue;
          
          await createDeal({
            title: `🔥 ${product.title}`,
            description: product.description || `Super okazja! ${product.title} z ${discount}% zniżką!`,
            price: product.price,
            originalPrice: product.originalPrice,
            link: product.productUrl,
            image: product.imageUrl,
            imageHint: '',
            mainCategorySlug: category.slug,
            subCategorySlug: category.slug,
            category: category.slug,
            postedBy: 'system',
            commentsCount: 0,
            source: 'aliexpress', // KLUCZOWE: deal pochodzi z AliExpress
            status: 'draft', // Wymaga akceptacji admina
            temperature: 50 + Math.min(discount, 50), // Im większa zniżka, tym wyższa temperatura
            voteCount: Math.floor(product.orders / 100), // Głosy bazowane na zamówieniach
            merchant: product.merchant || 'AliExpress',
            externalOriginalId: product.id,
            dealType: 'sale',
            freeShipping: product.shippingInfo?.freeShipping || false,
          });
          
          totalDeals++;
        } catch (e) {
          console.warn(`Nie udało się utworzyć deala:`, e);
        }
      }
    } catch (e) {
      console.error(`Błąd przy pobieraniu deali dla ${category.name}:`, e);
    }
  }
  
  return `Pobrano ${totalDeals} deali z AliExpress (status: draft, wymagana akceptacja).`;
}
