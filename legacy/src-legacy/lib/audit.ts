/**
 * Audit Log Service (M2)
 * 
 * Comprehensive audit trail for all administrative actions
 * Tracks changes with snapshots for full history
 */

import { logger } from '@/lib/logging';
import {
  AuditLog,
  DetailedAuditLog,
  ProductSnapshot,
  DealSnapshot,
  Product,
  Deal,
} from '@/lib/types';
import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';

/**
 * Create audit log entry
 */
export async function createAuditLog(
  action: string,
  userId: string,
  resourceType: string,
  resourceId: string,
  changes?: Record<string, any>,
  metadata?: Record<string, any>,
  userEmail?: string,
  duration?: number
): Promise<DetailedAuditLog> {
  try {
    const auditRef = doc(collection(db, 'auditLogs'));
    const now = new Date().toISOString();

    const auditLog: DetailedAuditLog = {
      id: auditRef.id,
      action,
      userId,
      userEmail,
      resourceType,
      resourceId,
      changes,
      timestamp: now,
      metadata,
      duration,
    };

    await setDoc(auditRef, {
      ...auditLog,
      timestamp: Timestamp.fromDate(new Date(auditLog.timestamp)),
    });

    logger.info('Audit log created', {
      auditId: auditLog.id,
      action,
      resourceType,
      resourceId,
    });

    return auditLog;
  } catch (error) {
    logger.error('Failed to create audit log', { action, resourceId, error });
    throw error;
  }
}

/**
 * Create product snapshot
 */
export async function createProductSnapshot(
  product: Product,
  userId: string,
  changeType: ProductSnapshot['changeType'],
  changeSummary: string
): Promise<ProductSnapshot> {
  try {
    const snapshotRef = doc(collection(db, 'productSnapshots'));
    const now = new Date().toISOString();

    // Get current version number
    const existingSnapshots = await getDocs(
      query(
        collection(db, 'productSnapshots'),
        where('productId', '==', product.id),
        orderBy('version', 'desc'),
        limit(1)
      )
    );

    const currentVersion = existingSnapshots.empty
      ? 0
      : existingSnapshots.docs[0].data().version;
    const newVersion = currentVersion + 1;

    const snapshot: ProductSnapshot = {
      id: snapshotRef.id,
      productId: product.id,
      snapshot: { ...product },
      version: newVersion,
      createdAt: now,
      createdBy: userId,
      changeType,
      changeSummary,
      parentVersion: currentVersion > 0 ? currentVersion : undefined,
    };

    await setDoc(snapshotRef, {
      ...snapshot,
      createdAt: Timestamp.fromDate(new Date(snapshot.createdAt)),
    });

    logger.info('Product snapshot created', {
      snapshotId: snapshot.id,
      productId: product.id,
      version: newVersion,
      changeType,
    });

    return snapshot;
  } catch (error) {
    logger.error('Failed to create product snapshot', { productId: product.id, error });
    throw error;
  }
}

/**
 * Create deal snapshot
 */
export async function createDealSnapshot(
  deal: Deal,
  userId: string,
  changeType: DealSnapshot['changeType'],
  changeSummary: string
): Promise<DealSnapshot> {
  try {
    const snapshotRef = doc(collection(db, 'dealSnapshots'));
    const now = new Date().toISOString();

    // Get current version number
    const existingSnapshots = await getDocs(
      query(
        collection(db, 'dealSnapshots'),
        where('dealId', '==', deal.id),
        orderBy('version', 'desc'),
        limit(1)
      )
    );

    const currentVersion = existingSnapshots.empty
      ? 0
      : existingSnapshots.docs[0].data().version;
    const newVersion = currentVersion + 1;

    const snapshot: DealSnapshot = {
      id: snapshotRef.id,
      dealId: deal.id,
      snapshot: { ...deal },
      version: newVersion,
      createdAt: now,
      createdBy: userId,
      changeType,
      changeSummary,
      parentVersion: currentVersion > 0 ? currentVersion : undefined,
    };

    await setDoc(snapshotRef, {
      ...snapshot,
      createdAt: Timestamp.fromDate(new Date(snapshot.createdAt)),
    });

    logger.info('Deal snapshot created', {
      snapshotId: snapshot.id,
      dealId: deal.id,
      version: newVersion,
      changeType,
    });

    return snapshot;
  } catch (error) {
    logger.error('Failed to create deal snapshot', { dealId: deal.id, error });
    throw error;
  }
}

/**
 * Get audit logs for a resource
 */
export async function getResourceAuditLogs(
  resourceType: string,
  resourceId: string,
  limitCount?: number
): Promise<DetailedAuditLog[]> {
  try {
    let q = query(
      collection(db, 'auditLogs'),
      where('resourceType', '==', resourceType),
      where('resourceId', '==', resourceId),
      orderBy('timestamp', 'desc')
    );

    if (limitCount) {
      q = query(q, limit(limitCount));
    }

    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        timestamp: data.timestamp.toDate().toISOString(),
      } as DetailedAuditLog;
    });
  } catch (error) {
    logger.error('Failed to get resource audit logs', { resourceType, resourceId, error });
    throw error;
  }
}

/**
 * Get product snapshots (version history)
 */
export async function getProductSnapshots(
  productId: string,
  limitCount?: number
): Promise<ProductSnapshot[]> {
  try {
    let q = query(
      collection(db, 'productSnapshots'),
      where('productId', '==', productId),
      orderBy('version', 'desc')
    );

    if (limitCount) {
      q = query(q, limit(limitCount));
    }

    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt.toDate().toISOString(),
      } as ProductSnapshot;
    });
  } catch (error) {
    logger.error('Failed to get product snapshots', { productId, error });
    throw error;
  }
}

/**
 * Get deal snapshots (version history)
 */
export async function getDealSnapshots(
  dealId: string,
  limitCount?: number
): Promise<DealSnapshot[]> {
  try {
    let q = query(
      collection(db, 'dealSnapshots'),
      where('dealId', '==', dealId),
      orderBy('version', 'desc')
    );

    if (limitCount) {
      q = query(q, limit(limitCount));
    }

    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt.toDate().toISOString(),
      } as DealSnapshot;
    });
  } catch (error) {
    logger.error('Failed to get deal snapshots', { dealId, error });
    throw error;
  }
}

/**
 * Get audit logs for a user (all actions by this user)
 */
export async function getUserAuditLogs(
  userId: string,
  limitCount?: number
): Promise<DetailedAuditLog[]> {
  try {
    let q = query(
      collection(db, 'auditLogs'),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc')
    );

    if (limitCount) {
      q = query(q, limit(limitCount));
    }

    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        timestamp: data.timestamp.toDate().toISOString(),
      } as DetailedAuditLog;
    });
  } catch (error) {
    logger.error('Failed to get user audit logs', { userId, error });
    throw error;
  }
}
