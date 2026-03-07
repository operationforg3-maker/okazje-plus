import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Deal, Product } from '@/lib/types';
import { sanitizeDealRecord } from '@/lib/sanitizers';

const docToDeal = (snap: any): Deal => sanitizeDealRecord(snap.data(), snap.id);

export async function getDealsForModerationData(statusFilter?: string[], maxLimit = 200): Promise<Deal[]> {
  const dealsRef = collection(db, 'deals');
  const DEBUG = process.env.NEXT_PUBLIC_DEBUG === 'true';

  try {
    if (statusFilter && statusFilter.length > 0) {
      const queries = statusFilter.map(status =>
        query(dealsRef, where('status', '==', status), orderBy('createdAt', 'desc'), limit(Math.ceil(maxLimit / statusFilter.length)))
      );

      const snapshots = await Promise.all(queries.map(q => getDocs(q)));
      const deals = snapshots.flatMap(snapshot => snapshot.docs.map(docToDeal));

      DEBUG && console.log(`[getDealsForModeration] Filter: ${statusFilter.join(',')}, Found: ${deals.length}`);

      deals.sort((a, b) => new Date(b.postedAt || 0).getTime() - new Date(a.postedAt || 0).getTime());
      return deals.slice(0, maxLimit);
    }

    const statuses = ['approved', 'pending', 'draft', 'rejected'];
    const queries = statuses.map(status => query(dealsRef, where('status', '==', status), orderBy('createdAt', 'desc'), limit(50)));

    const snapshots = await Promise.all(queries.map(q => getDocs(q)));
    const all = snapshots.flatMap(snapshot => snapshot.docs.map(docToDeal));

    DEBUG && console.log(`[getDealsForModeration] All statuses, Found: ${all.length}`);

    all.sort((a, b) => new Date(b.postedAt || 0).getTime() - new Date(a.postedAt || 0).getTime());
    return all.slice(0, maxLimit);
  } catch (error) {
    console.error('[getDealsForModeration] Error:', error);
    throw error;
  }
}

export async function getPendingDealsData(): Promise<Deal[]> {
  return getDealsForModerationData(['pending', 'draft'], 100);
}

export async function getProductCoresForModerationData(statusFilter?: string[], maxLimit = 200): Promise<Product[]> {
  const productCoresRef = collection(db, 'product_cores');
  const DEBUG = process.env.NEXT_PUBLIC_DEBUG === 'true';

  try {
    if (statusFilter && statusFilter.length > 0) {
      const queries = statusFilter.map(status =>
        query(
          productCoresRef,
          where('status', '==', status),
          orderBy('createdAt', 'desc'),
          limit(Math.ceil(maxLimit / statusFilter.length))
        )
      );

      const snapshots = await Promise.all(queries.map(q => getDocs(q)));
      const products = snapshots.flatMap(snapshot => snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Product)));

      DEBUG && console.log(`[getProductCoresForModeration] Filter: ${statusFilter.join(',')}, Found: ${products.length}`);

      products.sort((a, b) => {
        const dateA = new Date(a.metadata?.importedAt || (a as any).createdAt || 0).getTime();
        const dateB = new Date(b.metadata?.importedAt || (b as any).createdAt || 0).getTime();
        return dateB - dateA;
      });

      return products.slice(0, maxLimit);
    }

    const statuses = ['approved', 'pending_approval', 'draft', 'rejected'];
    const queries = statuses.map(status =>
      query(productCoresRef, where('status', '==', status), orderBy('createdAt', 'desc'), limit(50))
    );

    const snapshots = await Promise.all(queries.map(q => getDocs(q)));
    const all = snapshots.flatMap(snapshot => snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Product)));

    DEBUG && console.log(`[getProductCoresForModeration] All statuses, Found: ${all.length}`);

    all.sort((a, b) => {
      const dateA = new Date(a.metadata?.importedAt || (a as any).createdAt || 0).getTime();
      const dateB = new Date(b.metadata?.importedAt || (b as any).createdAt || 0).getTime();
      return dateB - dateA;
    });

    return all.slice(0, maxLimit);
  } catch (error) {
    console.error('[getProductCoresForModeration] Error:', error);
    throw error;
  }
}

export async function getPendingProductsData(): Promise<Product[]> {
  return getProductCoresForModerationData(['pending_approval', 'draft'], 100);
}

export async function getRecentlyModeratedData(status: 'approved' | 'rejected', days: number = 7): Promise<(Deal | Product)[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffTime = cutoffDate.getTime();

  const dealsRef = collection(db, 'deals');
  const dealsQuery = query(dealsRef, where('status', '==', status), orderBy('updatedAt', 'desc'), limit(100));
  const dealsSnapshot = await getDocs(dealsQuery);
  const deals = dealsSnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data(), type: 'deal' } as any))
    .filter(deal => {
      const updatedAt = deal.updatedAt?.toDate?.() || new Date(0);
      return updatedAt.getTime() >= cutoffTime;
    })
    .slice(0, 50);

  const productsRef = collection(db, 'products');
  const productsQuery = query(productsRef, where('status', '==', status), orderBy('updatedAt', 'desc'), limit(100));
  const productsSnapshot = await getDocs(productsQuery);
  const products = productsSnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data(), type: 'product' } as any))
    .filter(product => {
      const updatedAt = product.updatedAt?.toDate?.() || new Date(0);
      return updatedAt.getTime() >= cutoffTime;
    })
    .slice(0, 50);

  const all = [...deals, ...products];
  all.sort((a, b) => {
    const dateA = a.updatedAt?.toDate?.() || new Date(0);
    const dateB = b.updatedAt?.toDate?.() || new Date(0);
    return dateB.getTime() - dateA.getTime();
  });

  return all.slice(0, 50);
}
