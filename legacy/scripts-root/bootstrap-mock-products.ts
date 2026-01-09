import { adminDb } from '@/lib/firebase-admin';
import { ProductCore, DealM6 } from '@/lib/types';
import { calculateIdentityHash } from '@/lib/automation/identity-matcher';

type MockProduct = {
  title: string;
  category: string;
  price: number;
  rating: number;
  ratingCount: number;
  image: string;
  merchant: string;
  specs: Record<string, string>;
};

const MOCK_PRODUCTS: MockProduct[] = [
  // Electronics / Smartphones
  {
    title: 'Xiaomi Redmi Note 13',
    category: 'electronics/smartfony-telefony/smartphone',
    price: 599,
    rating: 4.5,
    ratingCount: 1234,
    image: 'https://images.unsplash.com/photo-1511707267537-b85faf00021e?w=400&h=400&fit=crop',
    merchant: 'AliExpress',
    specs: { RAM: '8GB', Storage: '256GB', Screen: '6.7"' },
  },
  {
    title: 'Samsung Galaxy A54',
    category: 'electronics/smartfony-telefony/smartphone',
    price: 799,
    rating: 4.6,
    ratingCount: 2100,
    image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=400&fit=crop',
    merchant: 'AliExpress',
    specs: { RAM: '8GB', Storage: '128GB', Screen: '6.4"' },
  },
  {
    title: 'iPhone 14',
    category: 'electronics/smartfony-telefony/smartphone',
    price: 1299,
    rating: 4.8,
    ratingCount: 5000,
    image: 'https://images.unsplash.com/photo-1592286927505-1fed5b1b76f7?w=400&h=400&fit=crop',
    merchant: 'AliExpress',
    specs: { RAM: '6GB', Storage: '256GB', Screen: '6.1"' },
  },

  // Computers / Laptops
  {
    title: 'ASUS VivoBook 15',
    category: 'electronics/komputery/laptop',
    price: 1899,
    rating: 4.4,
    ratingCount: 856,
    image: 'https://images.unsplash.com/photo-1588872657840-790ff3bda245?w=400&h=400&fit=crop',
    merchant: 'AliExpress',
    specs: { CPU: 'Intel i7', RAM: '16GB', Storage: '512GB SSD' },
  },
  {
    title: 'Dell XPS 13',
    category: 'electronics/komputery/laptop',
    price: 2499,
    rating: 4.7,
    ratingCount: 1200,
    image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&h=400&fit=crop',
    merchant: 'AliExpress',
    specs: { CPU: 'Intel i5', RAM: '8GB', Storage: '512GB SSD' },
  },

  // Audio / Headphones
  {
    title: 'Sony WH-1000XM4 Headphones',
    category: 'electronics/audio-video/headphones',
    price: 349,
    rating: 4.9,
    ratingCount: 3500,
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop',
    merchant: 'AliExpress',
    specs: { Type: 'Over-ear', ANC: 'Yes', Battery: '30h' },
  },
  {
    title: 'Samsung Galaxy Buds Pro',
    category: 'electronics/audio-video/headphones',
    price: 199,
    rating: 4.5,
    ratingCount: 2200,
    image: 'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=400&h=400&fit=crop',
    merchant: 'AliExpress',
    specs: { Type: 'Earbuds', ANC: 'Yes', Battery: '18h' },
  },

  // Home / Furniture
  {
    title: 'Modern Sectional Sofa',
    category: 'home-garden/meble/sofa',
    price: 4999,
    rating: 4.3,
    ratingCount: 450,
    image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=400&fit=crop',
    merchant: 'AliExpress',
    specs: { Material: 'Fabric', Seats: '4-5', Color: 'Grey' },
  },
  {
    title: 'Leather Reclining Sofa',
    category: 'home-garden/meble/sofa',
    price: 3599,
    rating: 4.6,
    ratingCount: 780,
    image: 'https://images.unsplash.com/photo-1592078615290-033ee584e267?w=400&h=400&fit=crop',
    merchant: 'AliExpress',
    specs: { Material: 'Leather', Seats: '3', Color: 'Brown' },
  },

  // Fashion / Dresses
  {
    title: 'Elegant Evening Dress',
    category: 'fashion/odziez-damska/dress',
    price: 89,
    rating: 4.4,
    ratingCount: 1100,
    image: 'https://images.unsplash.com/photo-1595777712802-26d44d0b7410?w=400&h=400&fit=crop',
    merchant: 'AliExpress',
    specs: { Size: 'S-XL', Color: 'Black', Material: 'Polyester' },
  },
  {
    title: 'Summer Casual Dress',
    category: 'fashion/odziez-damska/dress',
    price: 49,
    rating: 4.2,
    ratingCount: 2800,
    image: 'https://images.unsplash.com/photo-1595623582154-2d3295fdc6c6?w=400&h=400&fit=crop',
    merchant: 'AliExpress',
    specs: { Size: 'S-XL', Color: 'Blue', Material: 'Cotton' },
  },

  // Additional Electronics
  {
    title: 'Apple iPad Pro 12.9"',
    category: 'electronics/komputery/tablet',
    price: 1299,
    rating: 4.8,
    ratingCount: 1900,
    image: 'https://images.unsplash.com/photo-1561108557-c4b40ea199f0?w=400&h=400&fit=crop',
    merchant: 'AliExpress',
    specs: { Storage: '256GB', Screen: '12.9"', Processor: 'M2' },
  },
  {
    title: 'Samsung Galaxy Tab S8',
    category: 'electronics/komputery/tablet',
    price: 899,
    rating: 4.5,
    ratingCount: 1400,
    image: 'https://images.unsplash.com/photo-1544716278-ca5e3af8abd8?w=400&h=400&fit=crop',
    merchant: 'AliExpress',
    specs: { Storage: '128GB', Screen: '11"', Processor: 'Snapdragon' },
  },

  // More variety
  {
    title: '4K Wireless Security Camera',
    category: 'electronics/audio-video/camera',
    price: 249,
    rating: 4.4,
    ratingCount: 890,
    image: 'https://images.unsplash.com/photo-1584622181566-09ffe2d63b31?w=400&h=400&fit=crop',
    merchant: 'AliExpress',
    specs: { Resolution: '4K', Type: 'Wireless', NightVision: 'Yes' },
  },
  {
    title: 'Nikon D3500 DSLR Camera',
    category: 'electronics/fotografia/digital-camera',
    price: 699,
    rating: 4.7,
    ratingCount: 950,
    image: 'https://images.unsplash.com/photo-1612198188060-c7c2a3b66eae?w=400&h=400&fit=crop',
    merchant: 'AliExpress',
    specs: { Megapixels: '24.2MP', Type: 'DSLR', Video: '4K' },
  },
];

async function bootstrapProducts() {
  console.log('🌱 Bootstrap Mock Products\n');
  
  const now = new Date().toISOString();
  let productsCreated = 0;
  let dealsCreated = 0;

  for (const mockProduct of MOCK_PRODUCTS) {
    try {
      // Parse category
      const [mainCat, subCat, subSubCat] = mockProduct.category.split('/');
      
      // Create ProductCore
      const identityHash = calculateIdentityHash(mockProduct.title, mockProduct.image);
      
      const productCore: ProductCore = {
        id: '',
        identityHash,
        title: {
          pl: mockProduct.title,
          en: mockProduct.title,
          de: mockProduct.title,
        },
        shortDescription: {
          pl: `Product from ${mockProduct.merchant}`,
          en: `Product from ${mockProduct.merchant}`,
          de: `Product from ${mockProduct.merchant}`,
        },
        fullDescription: {
          pl: '',
          en: '',
          de: '',
        },
        specs: mockProduct.specs,
        mainCategorySlug: mainCat,
        subCategorySlug: subCat,
        subSubCategorySlug: subSubCat,
        images: [mockProduct.image],
        primaryImageHash: mockProduct.image.split('=')[1] || 'mock',
        videoUrl: undefined,
        reviewsSummary: {
          pl: 'Brak opinii',
          en: 'No reviews yet',
          de: 'Keine Bewertungen',
        },
        rating: {
          score: mockProduct.rating,
          count: mockProduct.ratingCount,
          provider: 'mixed',
        },
        bestPrice: {
          amount: mockProduct.price,
          currency: 'PLN',
        },
        linkedDealIds: [],
        bestDealId: undefined,
        bestTotalPrice: undefined,
        searchTags: [],
        status: 'approved', // Immediately approved for demo
        createdAt: now,
        updatedAt: now,
        metadata: {
          source: 'aliexpress',
          originalId: `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          importedAt: now,
          aliexpressCategoryIds: [],
        } as any,
      };

      const productRef = await adminDb.collection('product_cores').add(productCore);
      const productId = productRef.id;
      productsCreated++;
      
      // Create Deal
      const deal: any = {
        productCoreId: productId,
        priceV2: {
          amount: mockProduct.price,
          currency: 'PLN',
        },
        price: mockProduct.price,
        originalPrice: mockProduct.price,
        shipping: {
          cost: 0,
          timeDays: 7,
        },
        shippingCost: 0,
        source: 'aliexpress',
        affiliateLink: `https://aliexpress.com/item/${Math.random().toString(36).slice(2, 10)}`,
        link: `https://aliexpress.com/item/${Math.random().toString(36).slice(2, 10)}`,
        merchantName: mockProduct.merchant,
        merchant: mockProduct.merchant,
        merchantRating: 4.5,
        seller: {
          name: mockProduct.merchant,
          url: 'https://aliexpress.com',
          rating: 4.5,
        },
        salesMetrics: {
          soldCount: Math.floor(Math.random() * 10000) + 100,
          reviewCount: mockProduct.ratingCount,
          avgRating: mockProduct.rating,
        },
        title: mockProduct.title,
        description: productCore.shortDescription.pl,
        stockStatus: 'in_stock',
        isActive: true,
        priceHistory: [
          {
            date: new Date().toISOString().split('T')[0],
            price: mockProduct.price,
          },
        ],
        mainCategorySlug: mainCat,
        subCategorySlug: subCat,
        subSubCategorySlug: subSubCat,
        temperature: 0.5 + Math.random() * 1.5, // Random heat 0.5-2
        upvotes: 0,
        downvotes: 0,
        views: 0,
        clicks: 0,
        shares: 0,
        commentsCount: 0,
        status: 'approved',
        createdAt: now,
        updatedAt: now,
      };

      await adminDb.collection('deals').add(deal);
      dealsCreated++;
      
      // Update ProductCore with deal reference
      await productRef.update({
        linkedDealIds: [deal.id],
        bestDealId: deal.id,
        bestTotalPrice: mockProduct.price,
      });

      console.log(`✅ ${mockProduct.title} (${mainCat}/${subCat})`);
    } catch (error) {
      console.error(`❌ ${mockProduct.title}:`, error);
    }
  }

  console.log(`\n🎉 Bootstrap Complete!`);
  console.log(`   Products Created: ${productsCreated}`);
  console.log(`   Deals Created: ${dealsCreated}`);
}

bootstrapProducts()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Bootstrap failed:', err);
    process.exit(1);
  });
