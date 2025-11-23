/**
 * POST /api/admin/deals/import
 * 
 * Import okazji - z CSV, URL lub bulk creation
 * Integracja z AI: auto-kategoryzacja + auto-linkowanie do produktów
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { aiSuggestCategory } from '@/ai/flows/aliexpress/aiSuggestCategory';
import { aiLinkDealToProduct } from '@/ai/flows/deals/aiLinkDealToProduct';
import { z } from 'zod';

const ImportDealSchema = z.object({
  title: z.string().min(5, 'Tytuł musi mieć minimum 5 znaków'),
  description: z.string().min(10, 'Opis musi mieć minimum 10 znaków'),
  price: z.number().positive('Cena musi być dodatnia'),
  originalPrice: z.number().positive().optional(),
  link: z.string().url('Link musi być poprawnym URL'),
  image: z.string().url('Zdjęcie musi być poprawnym URL'),
  merchant: z.string().optional(),
  shippingCost: z.number().optional(),
  
  // Rozszerzone parametry
  dealType: z.enum(['sale', 'coupon', 'freebie', 'pricing-error', 'cashback', 'bundle']).optional(),
  couponCode: z.string().optional(),
  freeShipping: z.boolean().optional(),
  cashback: z.object({
    amount: z.number().optional(),
    percentage: z.number().optional(),
    provider: z.string().optional(),
  }).optional(),
  minOrderValue: z.number().optional(),
  stockAlert: z.enum(['limited', 'low', 'ending-soon']).optional(),
  expiryDate: z.string().optional(), // ISO date
  availableQuantity: z.number().optional(),
  limitPerUser: z.number().optional(),
  requiresMembership: z.string().optional(),
  conditions: z.array(z.string()).optional(),
  gallery: z.array(z.string().url()).optional(),
  tags: z.array(z.string()).optional(),
  
  // Opcjonalne ręczne kategoryzowanie (jeśli nie podane, AI ustali)
  mainCategorySlug: z.string().optional(),
  subCategorySlug: z.string().optional(),
  subSubCategorySlug: z.string().optional(),
  
  // Źródło importu
  source: z.enum(['manual', 'csv', 'pepper', 'mydealz', 'reddit', 'other']).optional(),
});

type ImportDealInput = z.infer<typeof ImportDealSchema>;

export async function POST(request: NextRequest) {
  try {
    // 1. Autoryzacja - wymagany admin
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Brak tokena autoryzacji' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    
    if (!decodedToken.admin && !decodedToken.moderator) {
      return NextResponse.json({ error: 'Brak uprawnień administratora' }, { status: 403 });
    }

    // 2. Parsowanie danych wejściowych
    const body = await request.json();
    const { deals, autoCategorize = true, autoLinkProducts = true } = body;
    
    if (!Array.isArray(deals) || deals.length === 0) {
      return NextResponse.json({ error: 'Brak okazji do importu' }, { status: 400 });
    }

    // Walidacja każdej okazji
    const validatedDeals: ImportDealInput[] = [];
    const errors: Array<{ index: number; error: string }> = [];
    
    for (let i = 0; i < deals.length; i++) {
      try {
        const validated = ImportDealSchema.parse(deals[i]);
        validatedDeals.push(validated);
      } catch (err: any) {
        errors.push({ index: i, error: err.message || 'Błąd walidacji' });
      }
    }

    if (validatedDeals.length === 0) {
      return NextResponse.json({ 
        error: 'Wszystkie okazje zawierają błędy walidacji', 
        validationErrors: errors 
      }, { status: 400 });
    }

    // 3. Przetwarzanie okazji
    const results: Array<{
      success: boolean;
      dealId?: string;
      title: string;
      error?: string;
      categories?: { main: string; sub: string; subSub: string };
      linkedProducts?: Array<{ id: string; name: string; score: number }>;
    }> = [];

    for (const deal of validatedDeals) {
      try {
        // 3a. AI Kategoryzacja (jeśli nie podano kategorii ręcznie)
        let mainCategorySlug = deal.mainCategorySlug;
        let subCategorySlug = deal.subCategorySlug;
        let subSubCategorySlug = deal.subSubCategorySlug;
        
        if (autoCategorize && (!mainCategorySlug || !subCategorySlug || !subSubCategorySlug)) {
          console.log(`[Deals Import] AI kategoryzacja dla: ${deal.title}`);
          
          const categoryResult = await aiSuggestCategory({
            title: deal.title,
            description: deal.description,
            price: deal.price,
          });
          
          mainCategorySlug = categoryResult.mainCategorySlug;
          subCategorySlug = categoryResult.subCategorySlug;
          subSubCategorySlug = categoryResult.subSubCategorySlug;
          
          console.log(`[Deals Import] AI kategorie: ${mainCategorySlug}/${subCategorySlug}/${subSubCategorySlug}`);
        }
        
        // Fallback dla kategorii
        if (!mainCategorySlug || !subCategorySlug) {
          mainCategorySlug = 'inne';
          subCategorySlug = 'pozostale';
          subSubCategorySlug = 'niesklasyfikowane';
        }
        
        // 3b. AI Linkowanie do produktów (jeśli włączone)
        let linkedProductIds: string[] = [];
        const linkedProductsInfo: Array<{ id: string; name: string; score: number }> = [];
        
        if (autoLinkProducts) {
          console.log(`[Deals Import] AI linkowanie produktów dla: ${deal.title}`);
          
          // Pobierz produkty z podobnej kategorii (max 50)
          const productsSnapshot = await adminDb
            .collection('products')
            .where('status', '==', 'approved')
            .where('mainCategorySlug', '==', mainCategorySlug)
            .limit(50)
            .get();
          
          const availableProducts = productsSnapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name,
            description: doc.data().description || '',
            price: doc.data().price || 0,
            affiliateUrl: doc.data().affiliateUrl || '',
            mainCategorySlug: doc.data().mainCategorySlug,
            subCategorySlug: doc.data().subCategorySlug,
            subSubCategorySlug: doc.data().subSubCategorySlug,
          }));
          
          if (availableProducts.length > 0) {
            const linkResult = await aiLinkDealToProduct({
              dealTitle: deal.title,
              dealDescription: deal.description,
              dealUrl: deal.link,
              dealPrice: deal.price,
              dealMerchant: deal.merchant,
              availableProducts,
            });
            
            console.log(`[Deals Import] AI linkowanie: ${linkResult.recommendation}, dopasowań: ${linkResult.matches.length}`);
            
            // Auto-link tylko dla high confidence
            if (linkResult.recommendation === 'auto-link' && linkResult.matches.length > 0) {
              const bestMatch = linkResult.matches[0];
              if (bestMatch.confidence === 'high' && bestMatch.matchScore >= 85) {
                linkedProductIds = [bestMatch.productId];
                linkedProductsInfo.push({
                  id: bestMatch.productId,
                  name: bestMatch.productName,
                  score: bestMatch.matchScore,
                });
                console.log(`[Deals Import] Auto-linked do produktu: ${bestMatch.productName} (score: ${bestMatch.matchScore})`);
              }
            }
            
            // Dla review - zapisz sugestie w metadata
            if (linkResult.recommendation === 'review') {
              linkedProductsInfo.push(...linkResult.matches.slice(0, 3).map(m => ({
                id: m.productId,
                name: m.productName,
                score: m.matchScore,
              })));
            }
          }
        }
        
        // 3c. Utworzenie okazji w Firestore
        const dealData = {
          title: deal.title,
          description: deal.description,
          price: deal.price,
          originalPrice: deal.originalPrice || null,
          link: deal.link,
          image: deal.image,
          imageHint: '', // TODO: generować przez AI
          merchant: deal.merchant || '',
          shippingCost: deal.shippingCost || 0,
          postedBy: decodedToken.uid,
          postedAt: new Date().toISOString(),
          createdBy: decodedToken.uid,
          voteCount: 0,
          temperature: 0,
          commentsCount: 0,
          
          // Kategorie (3 poziomy)
          category: mainCategorySlug, // backward compatibility
          mainCategorySlug,
          subCategorySlug,
          subSubCategorySlug: subSubCategorySlug || '',
          
          // Status
          status: 'approved', // auto-approve dla admina (można zmienić na 'draft')
          
          // Rozszerzone parametry
          dealType: deal.dealType || 'sale',
          couponCode: deal.couponCode || null,
          freeShipping: deal.freeShipping || false,
          cashback: deal.cashback || null,
          minOrderValue: deal.minOrderValue || null,
          stockAlert: deal.stockAlert || null,
          expiryDate: deal.expiryDate || null,
          availableQuantity: deal.availableQuantity || null,
          limitPerUser: deal.limitPerUser || null,
          requiresMembership: deal.requiresMembership || null,
          conditions: deal.conditions || [],
          gallery: deal.gallery || [],
          tags: deal.tags || [],
          verified: false, // wymaga weryfikacji moderatora
          
          // Linkowanie produktów
          linkedProductIds,
          
          // Źródło
          source: deal.source || 'manual',
          
          // Import metadata
          importMetadata: {
            source: deal.source || 'manual',
            importedAt: new Date().toISOString(),
            importedBy: decodedToken.uid,
            autoCategorizationUsed: autoCategorize,
            autoLinkingUsed: autoLinkProducts,
            suggestedProducts: linkedProductsInfo.length > 0 ? linkedProductsInfo : null,
          },
          
          // Timestamps
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        const dealRef = await adminDb.collection('deals').add(dealData);
        
        // 3d. Aktualizacja powiązanych produktów (dodaj dealId do linkedDealIds)
        if (linkedProductIds.length > 0) {
          for (const productId of linkedProductIds) {
            try {
              const productRef = adminDb.collection('products').doc(productId);
              const productDoc = await productRef.get();
              
              if (productDoc.exists) {
                const existingDealIds = productDoc.data()?.linkedDealIds || [];
                await productRef.update({
                  linkedDealIds: [...existingDealIds, dealRef.id],
                  updatedAt: new Date().toISOString(),
                });
                console.log(`[Deals Import] Zaktualizowano produkt ${productId} z dealId ${dealRef.id}`);
              }
            } catch (err) {
              console.error(`[Deals Import] Błąd aktualizacji produktu ${productId}:`, err);
            }
          }
        }
        
        results.push({
          success: true,
          dealId: dealRef.id,
          title: deal.title,
          categories: { 
            main: mainCategorySlug, 
            sub: subCategorySlug, 
            subSub: subSubCategorySlug || '' 
          },
          linkedProducts: linkedProductsInfo.length > 0 ? linkedProductsInfo : undefined,
        });
        
        console.log(`[Deals Import] ✅ Zaimportowano okazję: ${deal.title} (ID: ${dealRef.id})`);
        
      } catch (err: any) {
        console.error(`[Deals Import] ❌ Błąd importu okazji "${deal.title}":`, err);
        results.push({
          success: false,
          title: deal.title,
          error: err.message || 'Nieznany błąd',
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    return NextResponse.json({
      success: true,
      message: `Zaimportowano ${successCount}/${validatedDeals.length} okazji`,
      imported: successCount,
      failed: failureCount,
      validationErrors: errors.length > 0 ? errors : undefined,
      results,
    });
    
  } catch (error: any) {
    console.error('[Deals Import] Błąd:', error);
    return NextResponse.json(
      { error: error.message || 'Błąd importu okazji' },
      { status: 500 }
    );
  }
}
