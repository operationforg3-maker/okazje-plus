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
  const dealData = {
    title,
    description: description || '',
    price,
    originalPrice: originalPrice || null,
    link,
    image: image || '',
    mainCategorySlug,
    subCategorySlug,
    subSubCategorySlug: subSubCategorySlug || null,
    createdBy: session.email,
    createdAt: new Date().toISOString(),
    status: 'pending', // Wymaga moderacji
    votes: 0,
    temperature: 0,
    comments: [],
    source: 'user_submission',
    sourceId: `user-${Date.now()}`,
  };

  // Zapisanie do Firestore
  const docId = await createDeal(dealData);
  return { id: docId };
}
