import { NextRequest, NextResponse } from "next/server";
import { requestDealIndexing } from "@/lib/google-indexing";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/auth-server";
import { FieldValue } from "firebase-admin/firestore";
import { recalculateBestPrices } from "@/lib/automation/best-price";

/**
 * Single item moderation endpoint
 * Body: { itemId, itemType: 'deal'|'product', action: 'approve'|'reject' }
 * 
 * ✅ Features:
 * - Atomic Deal↔ProductCore synchronization
 * - Google Indexing API integration
 * - Full moderation logging
 * - Proper error handling
 */
export async function POST(request: NextRequest) {
  try {
    // Weryfikacja tokena i uprawnień admina
    const session = await requireAdmin();
    const { itemId, itemType, action, editPayload } = await request.json();

    if (!itemId || !itemType || !action) {
      return NextResponse.json(
        { success: false, message: "Brak wymaganych danych" },
        { status: 400 }
      );
    }

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { success: false, message: "Nieprawidłowa akcja" },
        { status: 400 }
      );
    }

    if (!["deal", "product"].includes(itemType)) {
      return NextResponse.json(
        { success: false, message: "Nieprawidłowy typ elementu" },
        { status: 400 }
      );
    }

    // M6: Określ nazwę kolekcji (product -> product_cores)
    const collectionName = itemType === "deal" ? "deals" : "product_cores";
    const itemRef = adminDb.collection(collectionName).doc(itemId);

    // Pobierz obecny status przed aktualizacją
    const beforeSnap = await itemRef.get();
    const previousStatus = beforeSnap.exists ? beforeSnap.data()?.status : 'unknown';

    if (!beforeSnap.exists) {
      return NextResponse.json(
        { success: false, message: `${itemType} nie znaleziony` },
        { status: 404 }
      );
    }

    // ============ ATOMIC UPDATE — Deal Status + ProductCore Sync ============
    const newStatus = action === "approve" ? "approved" : "rejected";
    const ts = FieldValue.serverTimestamp();

    const itemUpdatePayload: Record<string, unknown> = {
      status: newStatus,
      updatedAt: ts,
    };

    if (newStatus === 'approved') {
      itemUpdatePayload.approvedAt = new Date().toISOString();
      if (itemType === 'deal') {
        itemUpdatePayload.promotedAt = new Date().toISOString();
      }
    } else if (newStatus === 'rejected') {
      itemUpdatePayload.rejectedAt = new Date().toISOString();
    }

    // If editPayload provided (from QuickEditDialog), merge safe fields
    const ALLOWED_EDIT_FIELDS = [
      'title', 'titlePl', 'description', 'descriptionPl', 'price', 'mainCategorySlug',
      'shippingCost', 'freeShipping', 'mainImage', 'image', 'imageUrl'
    ];
    if (editPayload && typeof editPayload === 'object' && action === 'approve') {
      for (const key of ALLOWED_EDIT_FIELDS) {
        if (key in editPayload && (editPayload as Record<string, unknown>)[key] !== undefined) {
          itemUpdatePayload[key] = (editPayload as Record<string, unknown>)[key];
        }
      }
    }

    let productIdToRecalculate: string | null = null;
    if (itemType === 'product') {
      productIdToRecalculate = itemId;
    } else if (itemType === 'deal') {
      const dealData = beforeSnap.data() as any;
      const productCoreId = dealData?.productCoreId || dealData?.productId;
      if (productCoreId) {
        productIdToRecalculate = String(productCoreId);
      }
    }

    // Use transaction for atomic Deal↔ProductCore update
    await adminDb.runTransaction(async (transaction) => {
      let productRefToUpdate: any = null;
      let productStatusToUpdate: string | null = null;
      let dealsToUpdate: any[] = [];

      // 1. All READS first
      if (itemType === 'deal' && action === 'approve' && beforeSnap.exists) {
        const dealData = beforeSnap.data() as any;
        const productCoreId = dealData?.productCoreId || dealData?.productId;

        if (productCoreId) {
          const productRef = adminDb.collection('product_cores').doc(String(productCoreId));
          const productSnap = await transaction.get(productRef);

          if (productSnap.exists) {
            const productStatus = productSnap.data()?.status;
            if (productStatus === 'pending_approval' || productStatus === 'draft') {
              productRefToUpdate = productRef;
              productStatusToUpdate = 'approved';
            }
          }
        }
      }

      // If approving/rejecting a product, sync status to all associated deals
      // Note: We use a standard query here because transaction queries have limitations
      if (itemType === 'product') {
        const productDealsSnap = await adminDb.collection('deals')
          .where('productId', '==', itemId)
          .get();

        for (const dealDoc of productDealsSnap.docs) {
          const dealData = dealDoc.data();
          const currentStatus = dealData.status;

          if (action === 'approve') {
            if (['pending', 'draft', 'poczekalnia'].includes(currentStatus)) {
              dealsToUpdate.push({ ref: dealDoc.ref, newStatus: 'approved' });
            }
          } else if (action === 'reject') {
            if (currentStatus !== 'rejected') {
              dealsToUpdate.push({ ref: dealDoc.ref, newStatus: 'rejected' });
            }
          }
        }
      }

      // 2. All WRITES after reads
      transaction.update(itemRef, itemUpdatePayload);

      if (productRefToUpdate && productStatusToUpdate) {
        transaction.update(productRefToUpdate, {
          status: productStatusToUpdate,
          approvedAt: new Date().toISOString(),
          updatedAt: ts,
        });
      }

      for (const deal of dealsToUpdate) {
        const updateData: any = {
          status: deal.newStatus,
          updatedAt: ts,
        };
        if (deal.newStatus === 'approved') {
          updateData.approvedAt = new Date().toISOString();
          updateData.promotedAt = new Date().toISOString();
        } else if (deal.newStatus === 'rejected') {
          updateData.rejectedAt = new Date().toISOString();
        }
        transaction.update(deal.ref, updateData);
      }
    });

    if (productIdToRecalculate) {
      try {
        await recalculateBestPrices([productIdToRecalculate]);
      } catch (bestPriceErr) {
        console.error(`[Moderation] Warning: failed to recalculate best price for product ${productIdToRecalculate}:`, bestPriceErr);
      }
    }

    // ============ LOGGING (outside transaction) ============
    try {
      await adminDb.collection('moderation_log').add({
        action,
        targetType: itemType,
        targetId: itemId,
        moderatorId: session.uid,
        moderatorEmail: session.email || 'unknown',
        timestamp: new Date().toISOString(),
        metadata: {
          previousStatus,
        },
      });
    } catch (err: any) {
      console.error('Failed to log moderation:', err);
    }

    // ============ GOOGLE INDEXING (async, non-blocking) ============
    if (itemType === "deal") {
      (async () => {
        try {
          const indexAction = action === "approve" ? "URL_UPDATED" : "URL_DELETED";
          console.log(`[Moderation] Submitting deal ${itemId} to Google Indexing API (${indexAction})...`);
          const indexingResult = await requestDealIndexing(itemId, indexAction);
          console.log(`[Moderation] Google Indexing result:`, indexingResult);
        } catch (indexingError) {
          console.error(`[Moderation] Warning: Google Indexing failed for deal ${itemId}:`, indexingError);
          // Log failure for potential retry
          try {
            await adminDb.collection('indexing_failures').add({
              dealId: itemId,
              action: action === "approve" ? "URL_UPDATED" : "URL_DELETED",
              error: String(indexingError),
              timestamp: new Date().toISOString(),
              attempt: 1,
            });
          } catch (logErr) {
            console.error('[Moderation] Failed to log indexing failure:', logErr);
          }
        }
      })().catch(err => console.error('[Moderation] Indexing async error:', err));
    }

    return NextResponse.json(
      {
        success: true,
        message: `${itemType === "deal" ? "Okazja" : "Produkt"} został ${
          action === "approve" ? "zatwierdzony" : "odrzucony"
        }`,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Błąd podczas moderacji:", error);
    if (String(error?.message || '').includes('Unauthorized')) {
      return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
    }
    if (String(error?.message || '').includes('Forbidden')) {
      return NextResponse.json({ error: "Brak uprawnień admina" }, { status: 403 });
    }
    return NextResponse.json(
      { success: false, message: "Wystąpił błąd podczas przetwarzania żądania: " + error.message },
      { status: 500 }
    );
  }
}
