/**
 * Web Worker Pool Manager
 * 
 * Manages a pool of Web Workers for CPU-intensive operations,
 * providing load balancing, error handling, and progress reporting.
 */

import type { 
  WorkerMessage, 
  WorkerResponse, 
  BatchMatchRequest, 
  BatchMatchProgress 
} from '@/workers/place-matching-worker';
import type { PlaceMatchQuery, MatchingResult } from './matching/place-matching';

export interface WorkerPoolConfig {
  maxWorkers: number;
  workerScript: string;
  timeout: number; // Timeout in milliseconds
}

export interface WorkerTask {
  id: string;
  message: WorkerMessage;
  resolve: (result: any) => void;
  reject: (error: Error) => void;
  timeout?: NodeJS.Timeout;
  onProgress?: (progress: any) => void;
}

export interface WorkerInstance {
  id: string;
  worker: Worker;
  busy: boolean;
  currentTask?: WorkerTask;
  tasksCompleted: number;
  errorsEncountered: number;
  createdAt: Date;
}

const DEFAULT_CONFIG: WorkerPoolConfig = {
  maxWorkers: Math.max(1, Math.floor(navigator.hardwareConcurrency / 2) || 2),
  workerScript: '/workers/place-matching-worker.js',
  timeout: 30000, // 30 seconds
};

export class WorkerPoolManager {
  private config: WorkerPoolConfig;
  private workers: Map<string, WorkerInstance> = new Map();
  private taskQueue: WorkerTask[] = [];
  private taskCounter = 0;

  constructor(config: Partial<WorkerPoolConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the worker pool
   */
  async initialize(): Promise<void> {
    // Create initial workers
    for (let i = 0; i < this.config.maxWorkers; i++) {
      await this.createWorker();
    }
  }

  /**
   * Execute a single place matching query
   */
  async executeMatchQuery(
    query: PlaceMatchQuery,
    onProgress?: (progress: any) => void
  ): Promise<MatchingResult> {
    const taskId = this.generateTaskId();
    
    return new Promise((resolve, reject) => {
      const task: WorkerTask = {
        id: taskId,
        message: {
          id: taskId,
          type: 'MATCH_PLACES',
          payload: query,
        },
        resolve,
        reject,
        onProgress,
      };

      this.enqueueTask(task);
    });
  }

  /**
   * Execute batch place matching queries
   */
  async executeBatchMatch(
    request: BatchMatchRequest,
    onProgress?: (progress: BatchMatchProgress) => void
  ): Promise<MatchingResult[]> {
    const taskId = this.generateTaskId();
    
    return new Promise((resolve, reject) => {
      const task: WorkerTask = {
        id: taskId,
        message: {
          id: taskId,
          type: 'BATCH_MATCH',
          payload: request,
        },
        resolve: (result) => resolve(result.results),
        reject,
        onProgress,
      };

      this.enqueueTask(task);
    });
  }

  /**
   * Calculate string similarity using worker
   */
  async calculateSimilarity(str1: string, str2: string): Promise<number> {
    const taskId = this.generateTaskId();
    
    return new Promise((resolve, reject) => {
      const task: WorkerTask = {
        id: taskId,
        message: {
          id: taskId,
          type: 'CALCULATE_SIMILARITY',
          payload: { str1, str2 },
        },
        resolve,
        reject,
      };

      this.enqueueTask(task);
    });
  }

  /**
   * Get worker pool statistics
   */
  getStats(): {
    totalWorkers: number;
    busyWorkers: number;
    queuedTasks: number;
    totalTasksCompleted: number;
    totalErrors: number;
    averageTasksPerWorker: number;
  } {
    const workers = Array.from(this.workers.values());
    const busyWorkers = workers.filter(w => w.busy).length;
    const totalTasksCompleted = workers.reduce((sum, w) => sum + w.tasksCompleted, 0);
    const totalErrors = workers.reduce((sum, w) => sum + w.errorsEncountered, 0);
    const averageTasksPerWorker = workers.length > 0 ? totalTasksCompleted / workers.length : 0;

    return {
      totalWorkers: workers.length,
      busyWorkers,
      queuedTasks: this.taskQueue.length,
      totalTasksCompleted,
      totalErrors,
      averageTasksPerWorker: Math.round(averageTasksPerWorker),
    };
  }

  /**
   * Terminate all workers and clean up
   */
  async terminate(): Promise<void> {
    // Clear task queue
    this.taskQueue.forEach(task => {
      if (task.timeout) {
        clearTimeout(task.timeout);
      }
      task.reject(new Error('Worker pool terminated'));
    });
    this.taskQueue = [];

    // Terminate all workers
    for (const workerInstance of this.workers.values()) {
      workerInstance.worker.terminate();
    }
    this.workers.clear();
  }

  /**
   * Create a new worker instance
   */
  private async createWorker(): Promise<WorkerInstance> {
    const workerId = `worker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const worker = new Worker(this.config.workerScript);
    
    const workerInstance: WorkerInstance = {
      id: workerId,
      worker,
      busy: false,
      tasksCompleted: 0,
      errorsEncountered: 0,
      createdAt: new Date(),
    };

    // Set up message handler
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      this.handleWorkerMessage(workerInstance, event.data);
    };

    // Set up error handler
    worker.onerror = (error) => {
      this.handleWorkerError(workerInstance, error);
    };

    this.workers.set(workerId, workerInstance);
    return workerInstance;
  }

  /**
   * Handle worker message responses
   */
  private handleWorkerMessage(workerInstance: WorkerInstance, response: WorkerResponse): void {
    const task = workerInstance.currentTask;
    if (!task || task.id !== response.id) {
      console.warn('Received response for unknown task:', response.id);
      return;
    }

    // Clear timeout
    if (task.timeout) {
      clearTimeout(task.timeout);
      task.timeout = undefined;
    }

    switch (response.type) {
      case 'MATCH_RESULT':
      case 'SIMILARITY_RESULT':
      case 'BATCH_RESULT':
        // Task completed successfully
        workerInstance.busy = false;
        workerInstance.currentTask = undefined;
        workerInstance.tasksCompleted++;
        task.resolve(response.payload);
        this.processNextTask();
        break;

      case 'PROGRESS':
        // Progress update
        if (task.onProgress) {
          task.onProgress(response.payload);
        }
        break;

      case 'ERROR':
        // Task failed
        workerInstance.busy = false;
        workerInstance.currentTask = undefined;
        workerInstance.errorsEncountered++;
        task.reject(new Error(response.error || 'Worker task failed'));
        this.processNextTask();
        break;

      default:
        console.warn('Unknown response type:', response.type);
    }
  }

  /**
   * Handle worker errors
   */
  private handleWorkerError(workerInstance: WorkerInstance, error: ErrorEvent): void {
    console.error('Worker error:', error);
    
    const task = workerInstance.currentTask;
    if (task) {
      if (task.timeout) {
        clearTimeout(task.timeout);
      }
      task.reject(new Error(`Worker error: ${error.message}`));
    }

    // Remove failed worker and create a new one
    this.workers.delete(workerInstance.id);
    workerInstance.worker.terminate();
    
    // Create replacement worker
    this.createWorker().catch(err => {
      console.error('Failed to create replacement worker:', err);
    });

    this.processNextTask();
  }

  /**
   * Add task to queue and process if worker available
   */
  private enqueueTask(task: WorkerTask): void {
    this.taskQueue.push(task);
    this.processNextTask();
  }

  /**
   * Process next task in queue
   */
  private processNextTask(): void {
    if (this.taskQueue.length === 0) {
      return;
    }

    // Find available worker
    const availableWorker = Array.from(this.workers.values()).find(w => !w.busy);
    if (!availableWorker) {
      return;
    }

    // Get next task
    const task = this.taskQueue.shift();
    if (!task) {
      return;
    }

    // Assign task to worker
    availableWorker.busy = true;
    availableWorker.currentTask = task;

    // Set timeout
    task.timeout = setTimeout(() => {
      task.reject(new Error('Worker task timeout'));
      availableWorker.busy = false;
      availableWorker.currentTask = undefined;
      availableWorker.errorsEncountered++;
      this.processNextTask();
    }, this.config.timeout);

    // Send message to worker
    availableWorker.worker.postMessage(task.message);
  }

  /**
   * Generate unique task ID
   */
  private generateTaskId(): string {
    return `task_${++this.taskCounter}_${Date.now()}`;
  }
}

// Export singleton instance
export const workerPoolManager = new WorkerPoolManager();

// Initialize worker pool when module loads
if (typeof window !== 'undefined') {
  workerPoolManager.initialize().catch(error => {
    console.warn('Failed to initialize worker pool:', error);
  });

  // Clean up on page unload
  window.addEventListener('beforeunload', () => {
    workerPoolManager.terminate();
  });
}