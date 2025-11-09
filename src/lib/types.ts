
// Nowe interfejsy dla zagnieżdżonych kategorii

// Sub-subkategoria (poziom 3)
export interface SubSubcategory {
  name: string;
  slug: string; // unikalny w ramach podkategorii
  id?: string;
  icon?: string;
  description?: string;
  sortOrder?: number;
  image?: string;
}

// Podkategoria (poziom 2)
export interface Subcategory {
  name: string;
  slug: string; // unikalny w ramach kategorii nadrzędnej
  id?: string; // identyfikator dokumentu, jeśli przechowywany w osobnej kolekcji
  icon?: string;
  description?: string;
  sortOrder?: number;
  image?: string;
  highlight?: boolean;
  subcategories?: SubSubcategory[]; // Sub-subkategorie (opcjonalne)
}

export interface CategoryPromo {
  title: string;
  subtitle?: string;
  description?: string;
  image?: string;
  link?: string;
  cta?: string;
  badge?: string;
  color?: string;
}

export interface Category {
  id: string; // ID dokumentu (slug kategorii głównej)
  name: string;
  slug?: string;
  icon?: string;
  description?: string;
  sortOrder?: number;
  accentColor?: string;
  heroImage?: string;
  promo?: CategoryPromo;
  subcategories: Subcategory[]; // Tablica obiektów podkategorii
}

// Zaktualizowany interfejs Deal
export interface Deal {
  id: string;
  title: string;
  description: string;
  price: number;
  originalPrice?: number;
  link: string;
  image: string;
  imageHint: string;
  postedBy: string;
  postedAt: string; // Użyjemy ISO string dla spójności
  voteCount: number;
  temperature: number;
  commentsCount: number;
  category: string;
  mainCategorySlug: string; // NOWE pole
  subCategorySlug: string;  // NOWE pole
  subSubCategorySlug?: string; // NOWE pole dla poziomu 3
  merchant?: string;
  shippingCost?: number;
  status?: 'draft' | 'approved' | 'rejected';
  createdBy?: string;
}

// Zaktualizowany interfejs Product
export interface Product {
  id: string;
  name: string;
  description: string;
  longDescription: string;
  image: string;
  imageHint: string;
  affiliateUrl: string;
  ratingCard: ProductRatingCard;
  price: number;
  mainCategorySlug: string; // NOWE pole
  subCategorySlug: string;  // NOWE pole
  subSubCategorySlug?: string; // NOWE pole dla poziomu 3
  status: 'draft' | 'approved' | 'rejected'; // Status moderacji
  category?: string; // Stara wersja dla kompatybilności
}

// Reszta interfejsów pozostaje bez zmian
export interface ProductRatingCard {
  average: number;
  count: number;
  durability: number;
  easeOfUse: number;
  valueForMoney: number;
  versatility: number;
}

// Nowy interfejs dla pojedynczej oceny użytkownika
export interface ProductRating {
  id: string;
  productId: string;
  userId: string;
  userDisplayName?: string;
  rating: number; // 1-5
  durability: number;
  easeOfUse: number;
  valueForMoney: number;
  versatility: number;
  review?: string; // Opcjonalna recenzja tekstowa
  createdAt: string; // ISO string
}

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: 'admin' | 'user';
}

export interface Vote {
  direction: 'up' | 'down';
}

export interface Comment {
  id: string;
  dealId: string;
  userId: string;
  userDisplayName: string;
  content: string;
  createdAt: string; // ISO string
}

export interface Favorite {
  id: string;
  userId: string;
  itemId: string; // ID okazji lub produktu
  itemType: 'deal' | 'product';
  createdAt: string; // ISO string
}

export interface Notification {
  id: string;
  userId: string;
  type: 'comment_reply' | 'new_deal' | 'system' | 'deal_approved' | 'deal_rejected';
  title: string;
  message: string;
  link?: string; // Link do odpowiedniego zasobu
  itemId?: string; // ID powiązanego elementu (deal, product, comment)
  itemType?: 'deal' | 'product' | 'comment';
  read: boolean;
  createdAt: string; // ISO string
  metadata?: {
    dealTitle?: string;
    commentText?: string;
    categorySlug?: string;
    [key: string]: any;
  };
}

export interface NavigationShowcaseConfig {
  promotedType: 'deals' | 'products';
  promotedIds: string[];
  dealOfTheDayId?: string | null;
  productOfTheDayId?: string | null;
}
