/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { enforceAutomationRateLimit } from '../automation-rate-limit';

type RedisValue = string | number | (string | null)[] | null;

function createRedisMock() {
  const strings = new Map<string, string>();
  const sets = new Map<string, Set<string>>();

  return {
    handle(command: string, args: (string | number)[]): RedisValue {
      switch (command) {
        case 'PING':
          return 'PONG';
        case 'GET': {
          const key = String(args[0]);
          return strings.get(key) ?? null;
        }
        case 'SETEX': {
          const key = String(args[0]);
          const value = String(args[2]);
          strings.set(key, value);
          return 'OK';
        }
        case 'INCR': {
          const key = String(args[0]);
          const current = Number(strings.get(key) ?? '0');
          const next = current + 1;
          strings.set(key, String(next));
          return next;
        }
        case 'EXPIRE':
          return 1;
        case 'SADD': {
          const key = String(args[0]);
          const member = String(args[1]);
          if (!sets.has(key)) sets.set(key, new Set());
          sets.get(key)!.add(member);
          return 1;
        }
        case 'SREM': {
          const key = String(args[0]);
          const member = String(args[1]);
          if (!sets.has(key)) return 0;
          return sets.get(key)!.delete(member) ? 1 : 0;
        }
        case 'SMEMBERS': {
          const key = String(args[0]);
          return Array.from(sets.get(key) ?? []);
        }
        case 'MGET': {
          const keys = args as string[];
          return keys.map((k) => strings.get(String(k)) ?? null);
        }
        case 'DEL': {
          const keys = args as string[];
          let deleted = 0;
          keys.forEach((key) => {
            const k = String(key);
            if (strings.delete(k)) deleted += 1;
            if (sets.delete(k)) deleted += 1;
          });
          return deleted;
        }
        default:
          throw new Error(`Unhandled Redis command: ${command}`);
      }
    },
  };
}

describe('enforceAutomationRateLimit', () => {
  const redis = createRedisMock();

  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.test';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token';
    process.env.PINBRIDGE_REDIS_PREFIX = 'pinbridge-test';

    global.fetch = jest.fn(async (_url, options: any) => {
      const [command, ...args] = JSON.parse(options.body);
      const result = redis.handle(command, args);
      return {
        ok: true,
        json: async () => ({ result }),
      } as any;
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.PINBRIDGE_REDIS_PREFIX;
  });

  it('allows under caps for premium user', async () => {
    const sessionId = 'session_123';
    const sessionKey = `pinbridge-test:session:${sessionId}`;
    redis.handle('SETEX', [sessionKey, 3600, JSON.stringify({ userId: 'u1', premium: true })]);

    const request = new NextRequest('http://localhost/api/maps/google/place', {
      headers: {
        cookie: `pinbridge_session=${sessionId}`,
      },
    });

    const result = await enforceAutomationRateLimit(request);
    expect(result.allowed).toBe(true);
    expect(result.remaining?.daily).toBeGreaterThanOrEqual(0);
  });

  it('blocks when minute cap exceeded', async () => {
    const sessionId = 'session_456';
    const sessionKey = `pinbridge-test:session:${sessionId}`;
    redis.handle('SETEX', [sessionKey, 3600, JSON.stringify({ userId: 'u2', premium: false })]);

    const request = new NextRequest('http://localhost/api/maps/google/place', {
      headers: {
        cookie: `pinbridge_session=${sessionId}`,
      },
    });

    // Exhaust minute cap for free tier (perMinuteCap = 1)
    await enforceAutomationRateLimit(request);
    const result = await enforceAutomationRateLimit(request);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('minute');
    expect(result.retryAfterSeconds).toBe(60);
  });
});
