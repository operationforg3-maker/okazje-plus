import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { z } from 'zod';
import { enrichDeal } from '@/ai/deal-enricher';

// Schemat walidacji danych okazji (minimum dla draftu)
const dealSchema = z.object({
  title: z.string().min(3).max(160),
  description: z.string().min(10),
  price: z.coerce.number().min(0),
  originalPrice: z.coerce.number().min(0).optional(),
  link: z.string().url(),
  image: z.string().min(3), // może być URL lub ścieżka storage
  mainCategorySlug: z.string().min(1),
  subCategorySlug: z.string().min(1).optional(),
  merchant: z.string().optional(),
  shippingCost: z.coerce.number().min(0).optional(),
});

// Pola systemowe narzucane dla draftu zgodnie z rules
function baseDraftFields() {
  return {
    status: 'draft',
    temperature: 0,
    voteCount: 0,
    commentsCount: 0,
  } as const;
}

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json();
    console.log('[POST /api/admin/deals] Raw body:', JSON.stringify(raw, null, 2));

    // Wymagane: token użytkownika (ID token Firebase) w nagłówku Authorization
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Brak nagłówka Authorization Bearer <idToken>' }, { status: 401 });
    }

    // Lazy import admin auth (aby uniknąć kosztów przy braku wywołań)
    const { getAuth } = await import('firebase-admin/auth');
    const idToken = authHeader.substring('Bearer '.length).trim();
    let decoded;
    try {
      decoded = await getAuth().verifyIdToken(idToken);
    } catch (e) {
      console.error('[POST /api/admin/deals] Token verify error', e);
      return NextResponse.json({ error: 'Nieprawidłowy token użytkownika' }, { status: 401 });
    }

    // Walidacja payloadu
    const parsed = dealSchema.safeParse(raw);
    if (!parsed.success) {
      console.error('[POST /api/admin/deals] Validation issues:', parsed.error.flatten());
      return NextResponse.json({ error: 'Błędne dane', issues: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;

    // AI Enhancement (opcjonalne - tylko jeśli useAI=true lub enrichFullPipeline=true)
    let normalizedTitle = data.title;
    let enrichmentData: any = {};
    let usedAI = false;

    if (raw.useAI === true || raw.enrichFullPipeline === true) {
      try {
        if (raw.enrichFullPipeline === true) {
          // Full AI enrichment pipeline (KROK 3)
          console.log('[POST /api/admin/deals] 🤖 Running full deal enrichment pipeline...');
          const enriched = await enrichDeal({
            title: data.title,
            price: data.price,
            originalPrice: data.originalPrice,
            merchant: data.merchant,
            mainCategorySlug: data.mainCategorySlug,
            subCategorySlug: data.subCategorySlug,
          });
          
          normalizedTitle = enriched.normalizedTitle;
          enrichmentData = {
            enrichedDescription: enriched.seoDescription,
            enrichedKeywords: enriched.seoKeywords,
            metaTitle: enriched.metaTitle,
            metaDescription: enriched.metaDescription,
            qualityScore: enriched.qualityScore,
            qualityRecommendation: enriched.qualityRecommendation,
            enrichedAt: enriched.enrichedAt,
          };
          usedAI = true;
          console.log('[POST /api/admin/deals] ✅ Full enrichment complete, quality score:', enriched.qualityScore);
        } else {
          // Legacy: only title normalization
          console.log('[POST /api/admin/deals] 🤖 Running AI title normalization...');
          const titleResult = await enrichDeal({
            title: data.title,
            price: data.price,
            originalPrice: data.originalPrice,
          }).then(r => r.normalizedTitle);
          normalizedTitle = titleResult;
          usedAI = true;
          console.log('[POST /api/admin/deals] ✅ AI normalized title:', normalizedTitle);
        }
      } catch (aiError) {
        console.error('[POST /api/admin/deals] ⚠️ AI enrichment failed:', aiError);
        // Kontynuuj z oryginalnym tytułem
      }
    }

    // Określ źródło deala: jeśli użyto AI to 'ai', jeśli podano w payload to użyj tego, w przeciwnym razie 'api'
    const dealSource = usedAI ? 'ai' : (raw.source || 'api');

    // Konstruujemy dokument zgodny z rules (draft)
    const dealDoc = {
      ...data,
      title: normalizedTitle, // Użyj znormalizowanego tytułu jeśli AI było użyte
      ...enrichmentData, // Include enrichment results if available
      ...baseDraftFields(),
      imageHint: normalizedTitle,
      category: data.mainCategorySlug, // kompatybilność legacy
      postedBy: decoded.uid,
      postedAt: new Date().toISOString(),
      createdBy: decoded.uid,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      // Denormalizacja rabatu jeżeli dostępna cena oryginalna
      discountPercent: data.originalPrice ? Math.round(((data.originalPrice - data.price) / data.originalPrice) * 100) : undefined,
      source: usedAI ? (raw.enrichFullPipeline === true ? 'enricher' : 'ai') : (raw.source || 'api'),
    };

    console.log('[POST /api/admin/deals] Final doc to save:', JSON.stringify(dealDoc, null, 2));

    const ref = await adminDb.collection('deals').add(dealDoc);
    console.log('[POST /api/admin/deals] Saved with ID:', ref.id);

    return NextResponse.json({ success: true, id: ref.id }, { status: 201 });
  } catch (error) {
    const code = (error as any)?.code;
    console.error('[POST /api/admin/deals] Error:', error);
    const status = code === 'permission-denied' ? 403 : 500;
    return NextResponse.json({ error: 'Nie udało się zapisać okazji', code, message: (error as any)?.message }, { status });
  }
}
