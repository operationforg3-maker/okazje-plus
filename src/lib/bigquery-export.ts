/**
 * BigQuery Export Utilities (M5)
 * 
 * Handles exporting analytics data to BigQuery for deep analysis
 */

import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc as firestoreDoc,
  updateDoc,
  getDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  BigQueryExportJob,
  UserInteraction,
  SessionMetrics,
  KPISnapshot,
  UserSegment,
} from '@/lib/types';
import { logger } from '@/lib/logging';

/**
 * BigQuery table schemas
 * These would be used to create tables in BigQuery
 */
export const BIGQUERY_SCHEMAS = {
  interactions: {
    fields: [
      { name: 'id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'userId', type: 'STRING', mode: 'NULLABLE' },
      { name: 'sessionId', type: 'STRING', mode: 'NULLABLE' },
      { name: 'itemId', type: 'STRING', mode: 'REQUIRED' },
      { name: 'itemType', type: 'STRING', mode: 'REQUIRED' },
      { name: 'interactionType', type: 'STRING', mode: 'REQUIRED' },
      { name: 'timestamp', type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'duration', type: 'INTEGER', mode: 'NULLABLE' },
      { name: 'source', type: 'STRING', mode: 'NULLABLE' },
      { name: 'position', type: 'INTEGER', mode: 'NULLABLE' },
      { name: 'categorySlug', type: 'STRING', mode: 'NULLABLE' },
    ],
  },
  sessions: {
    fields: [
      { name: 'id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'sessionId', type: 'STRING', mode: 'REQUIRED' },
      { name: 'userId', type: 'STRING', mode: 'NULLABLE' },
      { name: 'startTime', type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'endTime', type: 'TIMESTAMP', mode: 'NULLABLE' },
      { name: 'durationSeconds', type: 'INTEGER', mode: 'NULLABLE' },
      { name: 'pageViews', type: 'INTEGER', mode: 'REQUIRED' },
      { name: 'views', type: 'INTEGER', mode: 'REQUIRED' },
      { name: 'clicks', type: 'INTEGER', mode: 'REQUIRED' },
      { name: 'votes', type: 'INTEGER', mode: 'REQUIRED' },
      { name: 'comments', type: 'INTEGER', mode: 'REQUIRED' },
      { name: 'shares', type: 'INTEGER', mode: 'REQUIRED' },
      { name: 'favorites', type: 'INTEGER', mode: 'REQUIRED' },
      { name: 'entryPage', type: 'STRING', mode: 'REQUIRED' },
      { name: 'exitPage', type: 'STRING', mode: 'NULLABLE' },
      { name: 'device', type: 'STRING', mode: 'REQUIRED' },
      { name: 'converted', type: 'BOOLEAN', mode: 'REQUIRED' },
    ],
  },
  kpis: {
    fields: [
      { name: 'id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'period', type: 'STRING', mode: 'REQUIRED' },
      { name: 'timestamp', type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'startDate', type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'endDate', type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'totalUsers', type: 'INTEGER', mode: 'REQUIRED' },
      { name: 'activeUsers', type: 'INTEGER', mode: 'REQUIRED' },
      { name: 'totalSessions', type: 'INTEGER', mode: 'REQUIRED' },
      { name: 'avgSessionDuration', type: 'FLOAT', mode: 'REQUIRED' },
      { name: 'pageViews', type: 'INTEGER', mode: 'REQUIRED' },
      { name: 'bounceRate', type: 'FLOAT', mode: 'REQUIRED' },
      { name: 'ctr', type: 'FLOAT', mode: 'REQUIRED' },
      { name: 'conversionRate', type: 'FLOAT', mode: 'REQUIRED' },
    ],
  },
  segments: {
    fields: [
      { name: 'id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'userId', type: 'STRING', mode: 'REQUIRED' },
      { name: 'segmentType', type: 'STRING', mode: 'REQUIRED' },
      { name: 'confidence', type: 'FLOAT', mode: 'REQUIRED' },
      { name: 'activityLevel', type: 'STRING', mode: 'REQUIRED' },
      { name: 'avgPricePoint', type: 'FLOAT', mode: 'NULLABLE' },
      { name: 'conversionRate', type: 'FLOAT', mode: 'NULLABLE' },
      { name: 'generatedAt', type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'version', type: 'INTEGER', mode: 'REQUIRED' },
    ],
  },
};

/**
 * Transform Firestore document to BigQuery row format
 */
function transformInteractionForBigQuery(interaction: UserInteraction): Record<string, any> {
  return {
    id: interaction.id,
    userId: interaction.userId || null,
    sessionId: interaction.metadata?.source || null,
    itemId: interaction.itemId,
    itemType: interaction.itemType,
    interactionType: interaction.interactionType,
    timestamp: interaction.timestamp,
    duration: interaction.duration || null,
    source: interaction.metadata?.source || null,
    position: interaction.metadata?.position || null,
    categorySlug: interaction.metadata?.categorySlug || null,
  };
}

function transformSessionForBigQuery(session: SessionMetrics): Record<string, any> {
  return {
    id: session.id,
    sessionId: session.sessionId,
    userId: session.userId || null,
    startTime: session.startTime,
    endTime: session.endTime || null,
    durationSeconds: session.durationSeconds || null,
    pageViews: session.pageViews,
    views: session.interactions.views,
    clicks: session.interactions.clicks,
    votes: session.interactions.votes,
    comments: session.interactions.comments,
    shares: session.interactions.shares,
    favorites: session.interactions.favorites,
    entryPage: session.entryPage,
    exitPage: session.exitPage || null,
    device: session.device,
    converted: session.converted,
  };
}

function transformKPIForBigQuery(kpi: KPISnapshot): Record<string, any> {
  return {
    id: kpi.id,
    period: kpi.period,
    timestamp: kpi.timestamp,
    startDate: kpi.startDate,
    endDate: kpi.endDate,
    totalUsers: kpi.metrics.totalUsers,
    activeUsers: kpi.metrics.activeUsers,
    totalSessions: kpi.metrics.totalSessions,
    avgSessionDuration: kpi.metrics.avgSessionDuration,
    pageViews: kpi.metrics.pageViews,
    bounceRate: kpi.metrics.bounceRate,
    ctr: kpi.metrics.ctr,
    conversionRate: kpi.metrics.conversionRate,
  };
}

function transformSegmentForBigQuery(segment: UserSegment): Record<string, any> {
  return {
    id: segment.id,
    userId: segment.userId,
    segmentType: segment.segmentType,
    confidence: segment.confidence,
    activityLevel: segment.characteristics.activityLevel,
    avgPricePoint: segment.characteristics.avgPricePoint || null,
    conversionRate: segment.characteristics.conversionRate || null,
    generatedAt: segment.generatedAt,
    version: segment.version,
  };
}

/**
 * Export data to BigQuery
 * Note: This is a simplified version. In production, you would use:
 * 1. BigQuery client library (@google-cloud/bigquery)
 * 2. Proper authentication (service account)
 * 3. Batch inserts for efficiency
 * 4. Error handling and retry logic
 */
export async function exportToBigQuery(
  dataType: BigQueryExportJob['dataType'],
  startDate: Date,
  endDate: Date,
  triggeredBy: 'scheduled' | 'manual',
  triggeredByUid?: string
): Promise<BigQueryExportJob> {
  try {
    logger.info('Starting BigQuery export', {
      dataType,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    // Create export job record
    const jobData: Omit<BigQueryExportJob, 'id'> = {
      dataType,
      status: 'pending',
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      bigQueryTable: `okazje_plus_${dataType}`,
      startedAt: new Date().toISOString(),
      triggeredBy,
      triggeredByUid,
    };

    const jobRef = await addDoc(collection(db, 'bigquery_export_jobs'), jobData);
    const jobId = jobRef.id;

    // Update status to running
    await updateDoc(jobRef, { status: 'running' });

    try {
      let recordCount = 0;
      let bytesExported = 0;
      const startISO = startDate.toISOString();
      const endISO = endDate.toISOString();

      // Export based on data type
      switch (dataType) {
        case 'interactions': {
          const interactionsRef = collection(db, 'user_interactions');
          const q = query(
            interactionsRef,
            where('timestamp', '>=', startISO),
            where('timestamp', '<', endISO)
          );
          const snapshot = await getDocs(q);
          
          const rows = snapshot.docs.map(doc => {
            const interaction = { id: doc.id, ...doc.data() } as UserInteraction;
            return transformInteractionForBigQuery(interaction);
          });

          recordCount = rows.length;
          bytesExported = JSON.stringify(rows).length;

          // In production: Insert into BigQuery
          // await bigquery.dataset('analytics').table('interactions').insert(rows);
          logger.info('Interactions export prepared', { recordCount });
          break;
        }

        case 'sessions': {
          const sessionsRef = collection(db, 'session_metrics');
          const q = query(
            sessionsRef,
            where('startTime', '>=', startISO),
            where('startTime', '<', endISO)
          );
          const snapshot = await getDocs(q);
          
          const rows = snapshot.docs.map(doc => {
            const session = { id: doc.id, ...doc.data() } as SessionMetrics;
            return transformSessionForBigQuery(session);
          });

          recordCount = rows.length;
          bytesExported = JSON.stringify(rows).length;
          
          logger.info('Sessions export prepared', { recordCount });
          break;
        }

        case 'kpis': {
          const kpisRef = collection(db, 'kpi_snapshots');
          const q = query(
            kpisRef,
            where('startDate', '>=', startISO),
            where('startDate', '<', endISO)
          );
          const snapshot = await getDocs(q);
          
          const rows = snapshot.docs.map(doc => {
            const kpi = { id: doc.id, ...doc.data() } as KPISnapshot;
            return transformKPIForBigQuery(kpi);
          });

          recordCount = rows.length;
          bytesExported = JSON.stringify(rows).length;
          
          logger.info('KPIs export prepared', { recordCount });
          break;
        }

        case 'segments': {
          const segmentsRef = collection(db, 'user_segments');
          const q = query(
            segmentsRef,
            where('updatedAt', '>=', startISO),
            where('updatedAt', '<', endISO)
          );
          const snapshot = await getDocs(q);
          
          const rows = snapshot.docs.map(doc => {
            const segment = { id: doc.id, ...doc.data() } as UserSegment;
            return transformSegmentForBigQuery(segment);
          });

          recordCount = rows.length;
          bytesExported = JSON.stringify(rows).length;
          
          logger.info('Segments export prepared', { recordCount });
          break;
        }

        case 'full': {
          // Export all data types
          logger.info('Full export not implemented - use individual exports');
          recordCount = 0;
          bytesExported = 0;
          break;
        }
      }

      // Update job as completed
      const finishedAt = new Date().toISOString();
      const durationMs = new Date(finishedAt).getTime() - new Date(jobData.startedAt).getTime();

      await updateDoc(jobRef, {
        status: 'completed',
        recordCount,
        bytesExported,
        finishedAt,
        durationMs,
      });

      logger.info('BigQuery export completed', {
        jobId,
        dataType,
        recordCount,
        durationMs,
      });

      return {
        id: jobId,
        ...jobData,
        status: 'completed',
        recordCount,
        bytesExported,
        finishedAt,
        durationMs,
      };
    } catch (error) {
      // Update job as failed
      await updateDoc(jobRef, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        finishedAt: new Date().toISOString(),
      });

      throw error;
    }
  } catch (error) {
    logger.error('BigQuery export failed', { dataType, error });
    throw error;
  }
}

/**
 * Schedule daily BigQuery export
 * This would typically be called from a Cloud Function scheduled trigger
 */
export async function scheduleDailyExport(): Promise<void> {
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 1);

  // Export all data types
  const dataTypes: BigQueryExportJob['dataType'][] = ['interactions', 'sessions', 'kpis', 'segments'];

  for (const dataType of dataTypes) {
    try {
      await exportToBigQuery(dataType, startDate, endDate, 'scheduled');
    } catch (error) {
      logger.error('Scheduled export failed', { dataType, error });
    }
  }
}

/**
 * Get export job status
 */
export async function getExportJobStatus(jobId: string): Promise<BigQueryExportJob | null> {
  try {
    const jobRef = firestoreDoc(db, 'bigquery_export_jobs', jobId);
    const jobSnap = await getDoc(jobRef);

    if (!jobSnap.exists()) {
      return null;
    }

    return {
      id: jobSnap.id,
      ...jobSnap.data(),
    } as BigQueryExportJob;
  } catch (error) {
    logger.error('Failed to get export job status', { jobId, error });
    return null;
  }
}

/**
 * List recent export jobs
 */
export async function listRecentExportJobs(limit: number = 20): Promise<BigQueryExportJob[]> {
  try {
    const jobsRef = collection(db, 'bigquery_export_jobs');
    const q = query(
      jobsRef,
      where('startedAt', '>=', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      // orderBy('startedAt', 'desc'), // Would need composite index
      // limit(limit)
    );

    const snapshot = await getDocs(q);
    const jobs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as BigQueryExportJob));

    // Sort in memory since we can't use orderBy without index
    jobs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

    return jobs.slice(0, limit);
  } catch (error) {
    logger.error('Failed to list export jobs', { error });
    return [];
  }
}
