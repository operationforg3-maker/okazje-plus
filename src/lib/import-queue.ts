/**
 * Import Queue System
 * 
 * Handles long-running import jobs with:
 * - Progress tracking
 * - Error recovery
 * - Cancellation support
 * - Rate limiting
 */

import { adminDb } from './firebase-admin';

export interface ImportJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  sources: string[];
  config: {
    maxProductsPerCategory: number;
    enableAdvancedFeatures: boolean;
    enableAIEnrichment: boolean;
    saveDraftsOnly: boolean;
  };
  progress: {
    currentSource: string;
    currentCategory: string;
    processedCategories: number;
    totalCategories: number;
    importedProducts: number;
    errors: string[];
  };
  results?: {
    totalProducts: number;
    totalVariants: number;
    bySource: Record<string, { products: number; variants: number; enriched: number }>;
    duration: number;
  };
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  createdBy: string;
}

export class ImportQueueManager {
  private static COLLECTION = 'importJobs';

  /**
   * Create new import job
   */
  static async createJob(
    sources: string[],
    config: ImportJob['config'],
    userId: string
  ): Promise<string> {
    const jobData: Omit<ImportJob, 'id'> = {
      status: 'pending',
      sources,
      config,
      progress: {
        currentSource: '',
        currentCategory: '',
        processedCategories: 0,
        totalCategories: 0,
        importedProducts: 0,
        errors: [],
      },
      createdAt: new Date().toISOString(),
      createdBy: userId,
    };

    const docRef = await adminDb.collection(this.COLLECTION).add(jobData);
    return docRef.id;
  }

  /**
   * Update job status
   */
  static async updateJobStatus(
    jobId: string,
    status: ImportJob['status'],
    additionalData?: Partial<ImportJob>
  ): Promise<void> {
    const updateData: any = { status };

    if (status === 'running' && !additionalData?.startedAt) {
      updateData.startedAt = new Date().toISOString();
    }

    if (status === 'completed' || status === 'failed') {
      updateData.completedAt = new Date().toISOString();
    }

    if (additionalData) {
      Object.assign(updateData, additionalData);
    }

    await adminDb.collection(this.COLLECTION).doc(jobId).update(updateData);
  }

  /**
   * Update job progress
   */
  static async updateProgress(
    jobId: string,
    progress: Partial<ImportJob['progress']>
  ): Promise<void> {
    const updateData: any = {};

    Object.entries(progress).forEach(([key, value]) => {
      updateData[`progress.${key}`] = value;
    });

    await adminDb.collection(this.COLLECTION).doc(jobId).update(updateData);
  }

  /**
   * Get job status
   */
  static async getJob(jobId: string): Promise<ImportJob | null> {
    const doc = await adminDb.collection(this.COLLECTION).doc(jobId).get();
    
    if (!doc.exists) {
      return null;
    }

    return { id: doc.id, ...doc.data() } as ImportJob;
  }

  /**
   * List user's jobs
   */
  static async listUserJobs(userId: string, limit = 20): Promise<ImportJob[]> {
    const snapshot = await adminDb
      .collection(this.COLLECTION)
      .where('createdBy', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ImportJob));
  }

  /**
   * Cancel running job
   */
  static async cancelJob(jobId: string): Promise<void> {
    await this.updateJobStatus(jobId, 'cancelled');
  }

  /**
   * Check if job should be cancelled
   */
  static async shouldCancel(jobId: string): Promise<boolean> {
    const job = await this.getJob(jobId);
    return job?.status === 'cancelled';
  }

  /**
   * Add error to job
   */
  static async addError(jobId: string, error: string): Promise<void> {
    const job = await this.getJob(jobId);
    if (!job) return;

    const errors = [...job.progress.errors, error];

    await adminDb.collection(this.COLLECTION).doc(jobId).update({
      'progress.errors': errors,
    });
  }
}
