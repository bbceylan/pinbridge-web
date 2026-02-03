/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';

type RedisValue = string | number | string[] | null;

function createRedisMock() {
  const strings = new Map<string, string>();

  return {
    handle(command: string, args: (string | number)[]): RedisValue {
      switch (command) {
        case 'SETEX': {
          const key = String(args[0]);
          const value = String(args[2]);
          strings.set(key, value);
          return 'OK';
        }
        default:
          return 'OK';
      }
    },
    get(key: string) {
      return strings.get(key) ?? null;
    },
  };
}

describe('POST /api/admin/session', () => {
  const redis = createRedisMock();

  beforeEach(() => {
    jest.resetModules();
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.test';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token';
    process.env.ADMIN_SETUP_TOKEN = 'admin-token';
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
    delete process.env.ADMIN_SETUP_TOKEN;
    delete process.env.PINBRIDGE_REDIS_PREFIX;
  });

  it('stores session when admin token is provided', async () => {
    const { POST } = await import('../session/route');
    const request = new NextRequest('http://localhost/api/admin/session', {
      method: 'POST',
      headers: {
        'x-admin-token': 'admin-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: 'session_1',
        userId: 'user_1',
        role: 'admin',
        premium: true,
        ttlSeconds: 3600,
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(payload.ok).toBe(true);
    expect(redis.get('pinbridge-test:session:session_1')).toContain('user_1');
  });

  it('rejects when admin token is missing', async () => {
    const { POST } = await import('../session/route');
    const request = new NextRequest('http://localhost/api/admin/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: 'session_1',
        userId: 'user_1',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
  });
});
