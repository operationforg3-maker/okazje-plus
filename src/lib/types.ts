
// Nowe interfejsy dla zagnieżdżonych kategorii
export interface Subcategory {
  name: string;
  slug: string; // unikalny w ramach kategorii nadrzędnej
}

export interface Category {
  id: string; // ID dokumentu (slug kategorii głównej)
  name: string;
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
  commentsCount: number;
  mainCategorySlug: string; // NOWE pole
  subCategorySlug: string;  // NOWE pole
  temperature: number; // System "ciepłoty" dla rankingu
  status: 'draft' | 'approved' | 'rejected'; // Status moderacji
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
