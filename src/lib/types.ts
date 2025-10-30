export interface Deal {
  id: string;
  title: string;
  description: string;
  price?: number;
  originalPrice?: number;
  promoCode?: string;
  link: string;
  image: string;
  imageHint: string;
  postedBy: string;
  postedAt: string;
  temperature: number;
  commentsCount: number;
}

export interface ProductRatingCard {
  average: number;
  count: number;
  durability: number;
  easeOfUse: number; // Zmieniono z aesthetics
  valueForMoney: number;
  versatility: number; // Zmieniono z functionality
}

export interface Product {
  id: string;
  name: string;
  description: string;
  longDescription: string;
  image: string;
  imageHint: string;
  affiliateUrl: string;
  ratingCard: ProductRatingCard;
  category: string;
  price: number;
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
