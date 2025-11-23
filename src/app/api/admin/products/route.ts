import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, collection, addDoc, Timestamp } from 'firebase/firestore';
import { app } from '@/lib/firebase';
import { aiTranslateProduct } from '@/ai/flows/aiTranslateProduct';

const db = getFirestore(app);

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // Walidacja wymaganych pól
    if (!data.name || !data.description || !data.price || !data.image || !data.affiliateUrl) {
      return NextResponse.json(
        { error: 'Brakuje wymaganych pól' },
        { status: 400 }
      );
    }

    // AI Translation (opcjonalne - tylko jeśli useAI=true)
    let translations = null;
    if (data.useAI !== false) { // Default: true (automatyczne AI)
      try {
        console.log('[Product Create] 🤖 Running AI translation...');
        translations = await aiTranslateProduct({
          name: data.name,
          description: data.description,
          longDescription: data.longDescription,
          seoKeywords: data.seoKeywords,
          metaTitle: data.metaTitle,
          metaDescription: data.metaDescription,
          targetLanguages: ['en', 'de'],
        });
        console.log('[Product Create] ✅ AI translation completed');
      } catch (aiError) {
        console.error('[Product Create] ⚠️ AI translation failed:', aiError);
        // Kontynuuj bez tłumaczenia
      }
    }

    // Przygotuj dane do zapisu
    const productData = {
      ...data,
      // Dodaj tłumaczenia jeśli są dostępne
      ...(translations && {
        nameEn: translations.en?.name,
        descriptionEn: translations.en?.description,
        longDescriptionEn: translations.en?.longDescription,
        seoKeywordsEn: translations.en?.seoKeywords,
        metaTitleEn: translations.en?.metaTitle,
        metaDescriptionEn: translations.en?.metaDescription,
        nameDe: translations.de?.name,
        descriptionDe: translations.de?.description,
        longDescriptionDe: translations.de?.longDescription,
        seoKeywordsDe: translations.de?.seoKeywords,
        metaTitleDe: translations.de?.metaTitle,
        metaDescriptionDe: translations.de?.metaDescription,
      }),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    // Zapisz do Firestore
    const docRef = await addDoc(collection(db, 'products'), productData);

    return NextResponse.json(
      { 
        success: true, 
        id: docRef.id,
        message: 'Produkt został dodany pomyślnie',
        aiTranslated: !!translations,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { error: 'Błąd podczas tworzenia produktu' },
      { status: 500 }
    );
  }
}
