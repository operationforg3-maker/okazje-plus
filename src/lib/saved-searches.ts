import { z } from 'zod';

/**
 * Saved Search / Smart Filter Types
 */

export const SavedSearchSchema = z.object({
  id: z.string().optional(),
  userId: z.string(),
  name: z.string().min(1, 'Nazwa wyszukiwania jest wymagana').max(100),
  description: z.string().optional(),
  filters: z.object({
    // Category filters
    mainCategories: z.array(z.string()).optional(),
    subCategories: z.array(z.string()).optional(),
    
    // Price filters
    minPrice: z.number().min(0).optional(),
    maxPrice: z.number().min(0).optional(),
    
    // Deal filters
    dealTypes: z.array(z.enum(['sale', 'coupon', 'freebie', 'pricing-error', 'cashback', 'bundle'])).optional(),
    freeShipping: z.boolean().optional(),
    
    // Quality filters
    minTemperature: z.number().optional(),
    verified: z.boolean().optional(),
    
    // Store filters
    merchants: z.array(z.string()).optional(),
    excludeMerchants: z.array(z.string()).optional(),
    
    // Additional filters
    tags: z.array(z.string()).optional(),
    keywords: z.string().optional(),
    
    // Stock filters
    stockStatus: z.array(z.enum(['in_stock', 'low_stock', 'out_of_stock'])).optional(),
  }),
  
  // Notification settings
  notificationsEnabled: z.boolean().default(false),
  notificationFrequency: z.enum(['instant', 'daily', 'weekly']).default('instant'),
  
  // Metadata
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  lastMatchedAt: z.string().optional(),
  matchCount: z.number().default(0),
  
  // UI settings
  isPinned: z.boolean().default(false),
  color: z.string().optional(), // Hex color for UI
});

export type SavedSearch = z.infer<typeof SavedSearchSchema>;

/**
 * Quick filter presets for common searches
 */
export const QUICK_FILTER_PRESETS: Omit<SavedSearch, 'id' | 'userId' | 'createdAt'>[] = [
  {
    name: '🔥 Gorące okazje',
    description: 'Okazje z temperaturą powyżej 100°',
    filters: {
      minTemperature: 100,
      verified: true,
    },
    notificationsEnabled: false,
    notificationFrequency: 'instant',
    matchCount: 0,
    isPinned: true,
    color: '#ff6b6b',
  },
  {
    name: '🚚 Darmowa dostawa',
    description: 'Tylko okazje z darmową wysyłką',
    filters: {
      freeShipping: true,
    },
    notificationsEnabled: false,
    notificationFrequency: 'instant',
    matchCount: 0,
    isPinned: false,
    color: '#51cf66',
  },
  {
    name: '💎 Premium (>500zł)',
    description: 'Drogie produkty w promocji',
    filters: {
      minPrice: 500,
    },
    notificationsEnabled: false,
    notificationFrequency: 'instant',
    matchCount: 0,
    isPinned: false,
    color: '#9775fa',
  },
  {
    name: '⚡ Błyskawiczne okazje',
    description: 'Flash deals i błędy cenowe',
    filters: {
      dealTypes: ['pricing-error'],
      minTemperature: 50,
    },
    notificationsEnabled: true,
    notificationFrequency: 'instant',
    matchCount: 0,
    isPinned: true,
    color: '#ffd43b',
  },
  {
    name: '✅ Zweryfikowane',
    description: 'Tylko potwierdzone przez moderatorów',
    filters: {
      verified: true,
    },
    notificationsEnabled: false,
    notificationFrequency: 'instant',
    matchCount: 0,
    isPinned: false,
    color: '#20c997',
  },
];

/**
 * Helper function to match deal against saved search filters
 */
export function matchesSavedSearch(deal: any, search: SavedSearch): boolean {
  const { filters } = search;

  // Category filters
  if (filters.mainCategories && filters.mainCategories.length > 0) {
    if (!filters.mainCategories.includes(deal.mainCategorySlug)) {
      return false;
    }
  }

  if (filters.subCategories && filters.subCategories.length > 0) {
    if (!filters.subCategories.includes(deal.subCategorySlug)) {
      return false;
    }
  }

  // Price filters
  if (filters.minPrice !== undefined && deal.price < filters.minPrice) {
    return false;
  }

  if (filters.maxPrice !== undefined && deal.price > filters.maxPrice) {
    return false;
  }

  // Deal type filters
  if (filters.dealTypes && filters.dealTypes.length > 0) {
    if (!deal.dealType || !filters.dealTypes.includes(deal.dealType)) {
      return false;
    }
  }

  // Free shipping filter
  if (filters.freeShipping && !deal.freeShipping) {
    return false;
  }

  // Temperature filter
  if (filters.minTemperature !== undefined && (deal.temperature || 0) < filters.minTemperature) {
    return false;
  }

  // Verified filter
  if (filters.verified && !deal.verified) {
    return false;
  }

  // Merchant filters
  if (filters.merchants && filters.merchants.length > 0) {
    if (!deal.merchant || !filters.merchants.includes(deal.merchant)) {
      return false;
    }
  }

  if (filters.excludeMerchants && filters.excludeMerchants.length > 0) {
    if (deal.merchant && filters.excludeMerchants.includes(deal.merchant)) {
      return false;
    }
  }

  // Tag filters
  if (filters.tags && filters.tags.length > 0) {
    const dealTags = deal.tags || [];
    const hasMatchingTag = filters.tags.some(tag => dealTags.includes(tag));
    if (!hasMatchingTag) {
      return false;
    }
  }

  // Keyword filter
  if (filters.keywords) {
    const keywords = filters.keywords.toLowerCase().split(' ');
    const searchText = `${deal.title} ${deal.description || ''}`.toLowerCase();
    const hasAllKeywords = keywords.every(keyword => searchText.includes(keyword));
    if (!hasAllKeywords) {
      return false;
    }
  }

  // Stock status filter
  if (filters.stockStatus && filters.stockStatus.length > 0) {
    const dealStock = deal.importMetadata?.stockStatus || 'unknown';
    if (!filters.stockStatus.includes(dealStock)) {
      return false;
    }
  }

  return true;
}

/**
 * Generate user-friendly description of filters
 */
export function describeFilters(filters: SavedSearch['filters']): string {
  const parts: string[] = [];

  if (filters.mainCategories && filters.mainCategories.length > 0) {
    parts.push(`Kategorie: ${filters.mainCategories.join(', ')}`);
  }

  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    if (filters.minPrice && filters.maxPrice) {
      parts.push(`Cena: ${filters.minPrice}-${filters.maxPrice} zł`);
    } else if (filters.minPrice) {
      parts.push(`Cena min: ${filters.minPrice} zł`);
    } else if (filters.maxPrice) {
      parts.push(`Cena max: ${filters.maxPrice} zł`);
    }
  }

  if (filters.dealTypes && filters.dealTypes.length > 0) {
    const typeNames: Record<string, string> = {
      sale: 'Wyprzedaż',
      coupon: 'Kod rabatowy',
      freebie: 'Gratis',
      'pricing-error': 'Błąd cenowy',
      cashback: 'Cashback',
      bundle: 'Zestaw',
    };
    parts.push(`Typy: ${filters.dealTypes.map(t => typeNames[t] || t).join(', ')}`);
  }

  if (filters.freeShipping) {
    parts.push('Darmowa wysyłka');
  }

  if (filters.minTemperature !== undefined) {
    parts.push(`Temperatura ≥ ${filters.minTemperature}°`);
  }

  if (filters.verified) {
    parts.push('Zweryfikowane');
  }

  if (filters.tags && filters.tags.length > 0) {
    parts.push(`Tagi: ${filters.tags.join(', ')}`);
  }

  if (filters.keywords) {
    parts.push(`Słowa kluczowe: "${filters.keywords}"`);
  }

  return parts.length > 0 ? parts.join(' • ') : 'Brak filtrów';
}
