/**
 * Unit tests for rate limiter
 */

import { RateLimiter } from '../rate-limiter';

describe('RateLimiter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should execute requests within rate limit immediately', async () => {
    const rateLimiter = new RateLimiter(5, 2); // 5 requests per second, max 2 concurrent
    const mockFn = jest.fn().mockResolvedValue('success');

    const startTime = Date.now();
    const results = await Promise.all([
      rateLimiter.execute(mockFn),
      rateLimiter.execute(mockFn),
    ]);

    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(results).toEqual(['success', 'success']);
    expect(mockFn).toHaveBeenCalledTimes(2);
    expect(duration).toBeLessThan(100); // Should be nearly immediate
  });

  it('should respect rate limits and delay requests', async () => {
    const rateLimiter = new RateLimiter(2, 5); // 2 requests per second
    const mockFn = jest.fn().mockResolvedValue('success');

    const startTime = Date.now();
    
    // Execute 3 requests - the third should be delayed
    const results = await Promise.all([
      rateLimiter.execute(mockFn),
      rateLimiter.execute(mockFn),
      rateLimiter.execute(mockFn),
    ]);

    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(results).toEqual(['success', 'success', 'success']);
    expect(mockFn).toHaveBeenCalledTimes(3);
    expect(duration).toBeGreaterThan(900); // Should take at least ~1 second due to rate limiting
  });

  it('should handle request failures gracefully', async () => {
    const rateLimiter = new RateLimiter(5, 2);
    const mockFn = jest.fn().mockRejectedValue(new Error('Request failed'));

    await expect(rateLimiter.execute(mockFn)).rejects.toThrow('Request failed');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should prioritize higher priority requests', async () => {
    const rateLimiter = new RateLimiter(1, 1); // Very restrictive to test ordering
    const results: string[] = [];
    
    const lowPriorityFn = jest.fn().mockImplementation(async () => {
      results.push('low');
      return 'low';
    });
    
    const highPriorityFn = jest.fn().mockImplementation(async () => {
      results.push('high');
      return 'high';
    });

    // Queue requests with different priorities
    const promises = [
      rateLimiter.execute(lowPriorityFn, 1),
      rateLimiter.execute(highPriorityFn, 10),
      rateLimiter.execute(lowPriorityFn, 1),
    ];

    await Promise.all(promises);

    // High priority should be executed before the second low priority
    expect(results[0]).toBe('low'); // First request executes immediately
    expect(results[1]).toBe('high'); // High priority goes next
    expect(results[2]).toBe('low'); // Low priority goes last
  });

  it('should provide queue status information', () => {
    const rateLimiter = new RateLimiter(5, 2);
    const status = rateLimiter.getQueueStatus();

    expect(status).toHaveProperty('queueLength');
    expect(status).toHaveProperty('processing');
    expect(status).toHaveProperty('requestCount');
    expect(status).toHaveProperty('windowStart');
    expect(typeof status.queueLength).toBe('number');
    expect(typeof status.processing).toBe('boolean');
  });

  it('should clear queue when requested', async () => {
    const rateLimiter = new RateLimiter(1, 1);
    const mockFn = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    // Queue several requests
    const promises = [
      rateLimiter.execute(mockFn),
      rateLimiter.execute(mockFn),
      rateLimiter.execute(mockFn),
    ];

    // Clear the queue immediately
    rateLimiter.clearQueue();

    // First request might succeed (if it started), others should fail
    const results = await Promise.allSettled(promises);
    const rejectedCount = results.filter(r => r.status === 'rejected').length;
    
    expect(rejectedCount).toBeGreaterThan(0);
  });
});