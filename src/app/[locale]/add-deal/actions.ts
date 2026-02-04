'use server';

import { getServerAuthSession } from '@/lib/auth-server';
import { createDeal } from '@/lib/data-admin';

export interface NewDealData {
  title: string;
  description: string;
  price: number;
  originalPrice?: number;
  link: string;
  image: string;
  mainCategorySlug: string;
  subCategorySlug: string;
  subSubCategorySlug?: string;
}

export async function createNewDeal(data: NewDealData) {
  // Walidacja auth - user musi być zalogowany ale nie musi być admin
  const session = await getServerAuthSession();
  
  if (!session?.email) {
    throw new Error('Musisz być zalogowany');
  }

  const {
    title,
    description,
    price,
    originalPrice,
    link,
    image,
    mainCategorySlug,
    subCategorySlug,
    subSubCategorySlug,
  } = data;

  // Tworzenie dokumentu Deal
  const dealData: Omit<any, "id" | "createdAt"> = {
    title: { pl: title, en: title, de: title },
    description: { pl: description || '', en: description || '', de: description || '' },
    price,
    originalPrice: originalPrice || null,
    link,
    image: image || '',
    imageHint: '',
    category: mainCategorySlug,
    mainCategorySlug,
    subCategorySlug,
    subSubCategorySlug: subSubCategorySlug || null,
    createdBy: session.email,
    createdAt: new Date().toISOString(),
    postedBy: session.email,
    postedAt: new Date().toISOString(),
    status: 'draft' as const, // Wymaga moderacji
    votes: 0,
    voteCount: 0,
    temperature: 0,
    comments: [],
    commentsCount: 0,
    source: 'user_submission',
    sourceId: `user-${Date.now()}`,
  };

  // Zapisanie do Firestore
  const docId = await createDeal(dealData);
  return { id: docId };
}
