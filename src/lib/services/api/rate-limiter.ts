/**
 * Rate limiting and request queuing for API calls
 */

interface QueuedRequest {
  id: string;
  execute: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  priority: number;
  createdAt: Date;
}

export class RateLimiter {
  private queue: QueuedRequest[] = [];
  private processing = false;
  private requestCount = 0;
  private windowStart = Date.now();
  private readonly windowMs = 1000; // 1 second window

  constructor(
    private readonly maxRequestsPerSecond: number,
    private readonly maxConcurrent: number = 5
  ) {}

  async execute<T>(
    requestFn: () => Promise<T>,
    priority: number = 0
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const request: QueuedRequest = {
        id: `req_${Date.now()}_${Math.random()}`,
        execute: requestFn,
        resolve,
        reject,
        priority,
        createdAt: new Date(),
      };

      // Insert request in priority order (higher priority first)
      const insertIndex = this.queue.findIndex(r => r.priority < priority);
      if (insertIndex === -1) {
        this.queue.push(request);
      } else {
        this.queue.splice(insertIndex, 0, request);
      }

      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      while (this.queue.length > 0) {
        // Check if we need to wait for rate limit reset
        const now = Date.now();
        if (now - this.windowStart >= this.windowMs) {
          this.requestCount = 0;
          this.windowStart = now;
        }

        if (this.requestCount >= this.maxRequestsPerSecond) {
          const waitTime = this.windowMs - (now - this.windowStart);
          if (waitTime > 0) {
            await this.sleep(waitTime);
            continue;
          }
        }

        // Process up to maxConcurrent requests
        const batch = this.queue.splice(0, Math.min(this.maxConcurrent, this.queue.length));
        const promises = batch.map(request => this.executeRequest(request));
        
        await Promise.allSettled(promises);
        this.requestCount += batch.length;
      }
    } finally {
      this.processing = false;
    }
  }

  private async executeRequest(request: QueuedRequest): Promise<void> {
    try {
      const result = await request.execute();
      request.resolve(result);
    } catch (error) {
      request.reject(error);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getQueueStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      requestCount: this.requestCount,
      windowStart: this.windowStart,
    };
  }

  clearQueue(): void {
    const remainingRequests = this.queue.splice(0);
    remainingRequests.forEach(request => {
      request.reject(new Error('Queue cleared'));
    });
  }
}