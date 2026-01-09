/**
 * Job Queue Abstractor
 * - Enqueue/dequeue operations
 * - Persistence (Firestore)
 * - Retry logic + exponential backoff
 * - Status tracking (pending, processing, completed, failed)
 */

import { logger } from "../logger";
import { db } from "../firebase";
import { collection, addDoc, updateDoc, doc, query, where, getDocs, QueryConstraint, deleteDoc } from "firebase/firestore";

export type JobStatus = "pending" | "processing" | "completed" | "failed" | "paused";

export interface Job<T = any> {
  id?: string;
  type: string; // e.g., "import_aliexpress", "enrichment", "typesense_index"
  status: JobStatus;
  payload: T;
  result?: any;
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
  attempts: number;
  maxAttempts: number;
  nextRetryAt?: number; // timestamp
  createdAt: number; // timestamp
  startedAt?: number;
  completedAt?: number;
  invokedBy: string; // user UID
  metadata?: Record<string, any>;
}

// ===== Job Queue =====
export class JobQueue {
  private jobsCollection = collection(db, "jobs");
  private retryDelayMs = 5000; // initial backoff

  // ===== Enqueue =====
  async enqueue<T>(
    type: string,
    payload: T,
    options?: {
      maxAttempts?: number;
      invokedBy?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<string> {
    const job: Job<T> = {
      type,
      status: "pending",
      payload,
      attempts: 0,
      maxAttempts: options?.maxAttempts || 3,
      createdAt: Date.now(),
      invokedBy: options?.invokedBy || "system",
      metadata: options?.metadata,
    };

    try {
      const docRef = await addDoc(this.jobsCollection, job);
      logger.info("Job enqueued", { jobId: docRef.id, type });
      return docRef.id;
    } catch (error) {
      logger.error("Failed to enqueue job", { type, error });
      throw error;
    }
  }

  // ===== Get job by ID =====
  async getJob(jobId: string): Promise<Job | null> {
    try {
      const docSnap = await getDocs(
        query(this.jobsCollection, where("__name__", "==", jobId))
      );
      if (docSnap.empty) return null;
      return { id: jobId, ...docSnap.docs[0].data() } as Job;
    } catch (error) {
      logger.error("Failed to get job", { jobId, error });
      return null;
    }
  }

  // ===== Dequeue next pending job =====
  async dequeue(): Promise<Job | null> {
    try {
      const q = query(
        this.jobsCollection,
        where("status", "==", "pending"),
        where("attempts", "<", 3),
        where("nextRetryAt", "==", null)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return null; // No pending jobs
      }

      const jobDoc = snapshot.docs[0];
      const jobData = jobDoc.data() as Omit<Job, "id">;

      // Update status to processing
      await updateDoc(jobDoc.ref, {
        status: "processing",
        startedAt: Date.now(),
        attempts: (jobData.attempts || 0) + 1,
      });

      return { id: jobDoc.id, ...jobData, attempts: jobData.attempts + 1 };
    } catch (error) {
      logger.error("Failed to dequeue job", { error });
      return null;
    }
  }

  // ===== Mark job complete =====
  async markComplete(jobId: string, result?: any): Promise<void> {
    try {
      const jobRef = doc(this.jobsCollection, jobId);
      await updateDoc(jobRef, {
        status: "completed",
        result,
        completedAt: Date.now(),
      });
      logger.info("Job completed", { jobId });
    } catch (error) {
      logger.error("Failed to mark job complete", { jobId, error });
      throw error;
    }
  }

  // ===== Mark job failed (with retry) =====
  async markFailed(
    jobId: string,
    error: Error,
    options?: { shouldRetry?: boolean }
  ): Promise<void> {
    try {
      const job = await this.getJob(jobId);
      if (!job) throw new Error(`Job ${jobId} not found`);

      const canRetry =
        (options?.shouldRetry !== false) && job.attempts < job.maxAttempts;

      if (canRetry) {
        const nextRetryDelay =
          this.retryDelayMs * Math.pow(2, job.attempts - 1);
        const nextRetryAt = Date.now() + nextRetryDelay;

        const jobRef = doc(this.jobsCollection, jobId);
        await updateDoc(jobRef, {
          status: "pending",
          error: {
            message: error.message,
            code: (error as any).code,
            stack: error.stack,
          },
          nextRetryAt,
        });

        logger.warn("Job marked for retry", {
          jobId,
          nextRetryMs: nextRetryDelay,
          attemptNumber: job.attempts,
        });
      } else {
        const jobRef = doc(this.jobsCollection, jobId);
        await updateDoc(jobRef, {
          status: "failed",
          error: {
            message: error.message,
            code: (error as any).code,
            stack: error.stack,
          },
          completedAt: Date.now(),
        });

        logger.error("Job failed permanently", { jobId, error: error.message });
      }
    } catch (error) {
      logger.error("Failed to mark job failed", { jobId, error });
      throw error;
    }
  }

  // ===== Pause job =====
  async pauseJob(jobId: string): Promise<void> {
    try {
      const jobRef = doc(this.jobsCollection, jobId);
      await updateDoc(jobRef, { status: "paused" });
      logger.info("Job paused", { jobId });
    } catch (error) {
      logger.error("Failed to pause job", { jobId, error });
      throw error;
    }
  }

  // ===== Resume job =====
  async resumeJob(jobId: string): Promise<void> {
    try {
      const jobRef = doc(this.jobsCollection, jobId);
      await updateDoc(jobRef, { status: "pending", nextRetryAt: null });
      logger.info("Job resumed", { jobId });
    } catch (error) {
      logger.error("Failed to resume job", { jobId, error });
      throw error;
    }
  }

  // ===== Get jobs by status =====
  async getJobsByStatus(status: JobStatus, limit: number = 10): Promise<Job[]> {
    try {
      const q = query(this.jobsCollection, where("status", "==", status));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Job)).slice(0, limit);
    } catch (error) {
      logger.error("Failed to get jobs by status", { status, error });
      return [];
    }
  }

  // ===== Clear old completed jobs (cleanup) =====
  async cleanupCompleted(olderThanMs: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    const cutoff = Date.now() - olderThanMs;
    const q = query(
      this.jobsCollection,
      where("status", "==", "completed"),
      where("completedAt", "<", cutoff)
    );

    try {
      const snapshot = await getDocs(q);
      for (const doc of snapshot.docs) {
        await deleteDoc(doc.ref);
      }
      logger.info("Cleanup completed", { deletedCount: snapshot.docs.length });
    } catch (error) {
      logger.error("Cleanup failed", { error });
    }
  }
}

// ===== Singleton =====
let queueInstance: JobQueue | null = null;

export function getJobQueue(): JobQueue {
  if (!queueInstance) {
    queueInstance = new JobQueue();
  }
  return queueInstance;
}
