/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';

type RedisValue = string | number | string[] | null;

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
        case 'MGET': {
          const keys = args as string[];
          return keys.map((k) => strings.get(String(k)) ?? null);
        }
        case 'SADD': {
          const key = String(args[0]);
          const member = String(args[1]);
          if (!sets.has(key)) sets.set(key, new Set());
          sets.get(key)!.add(member);
          return 1;
        }
        case 'SMEMBERS': {
          const key = String(args[0]);
          return Array.from(sets.get(key) ?? []);
        }
        case 'DEL': {
          const keys = args as string[];
          keys.forEach((key) => {
            strings.delete(String(key));
            sets.delete(String(key));
          });
          return 1;
        }
        default:
          throw new Error(`Unhandled Redis command: ${command}`);
      }
    },
    setString(key: string, value: string) {
      strings.set(key, value);
    },
    addToSet(key: string, value: string) {
      if (!sets.has(key)) sets.set(key, new Set());
      sets.get(key)!.add(value);
    },
  };
}

describe('GET /api/admin/automation-metrics', () => {
  const redis = createRedisMock();

  beforeEach(() => {
    jest.resetModules();
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.test';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token';
    process.env.PINBRIDGE_REDIS_PREFIX = 'pinbridge-test';
    process.env.PINBRIDGE_JWT_SECRET = 'test-secret';
    process.env.PINBRIDGE_JWT_ISSUER = 'pinbridge';
    process.env.PINBRIDGE_JWT_AUDIENCE = 'pinbridge-web';

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
    delete process.env.PINBRIDGE_JWT_SECRET;
    delete process.env.PINBRIDGE_JWT_ISSUER;
    delete process.env.PINBRIDGE_JWT_AUDIENCE;
  });

  it('returns aggregates and rolling series for admin', async () => {
    const { GET } = await import('../automation-metrics/route');

    const today = new Date().toISOString().slice(0, 10);
    const indexKey = `pinbridge-test:automation:index:free:${today}`;
    redis.addToSet(indexKey, 'user_1');
    redis.setString(`pinbridge-test:automation:daily:free:user_1:${today}`, '2');

    const request = new NextRequest('http://localhost/api/admin/automation-metrics', {
      headers: {
        Authorization: `Bearer ${createJwt({
          sub: 'admin',
          role: 'admin',
          premium: true,
          iss: 'pinbridge',
          aud: 'pinbridge-web',
          exp: Math.floor(Date.now() / 1000) + 60,
        }, 'test-secret')}`,
      },
    });

    const response = await GET(request);
    const payload = await response.json();

    expect(payload.aggregates.totalDaily).toBeGreaterThanOrEqual(2);
    expect(payload.aggregates.rolling7DaysSeries).toBeDefined();
  });

  it('returns rolling7Days per user when requested', async () => {
    const { GET } = await import('../automation-metrics/route');

    const today = new Date().toISOString().slice(0, 10);
    redis.setString(`pinbridge-test:automation:daily:free:user_1:${today}`, '3');

    const request = new NextRequest(
      'http://localhost/api/admin/automation-metrics?userId=user_1&tier=free',
      { headers: { Authorization: `Bearer ${createJwt({
        sub: 'admin',
        role: 'admin',
        premium: true,
        iss: 'pinbridge',
        aud: 'pinbridge-web',
        exp: Math.floor(Date.now() / 1000) + 60,
      }, 'test-secret')}` } }
    );

    const response = await GET(request);
    const payload = await response.json();

    expect(payload.rolling7Days).toBeDefined();
    expect(payload.rolling7Days.length).toBeGreaterThan(0);
  });
});

function base64Url(input: string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function createJwt(payload: Record<string, any>, secret: string) {
  const headerB64 = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadB64 = base64Url(JSON.stringify(payload));
  const data = `${headerB64}.${payloadB64}`;
  const signature = require('crypto')
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return `${data}.${signature}`;
}
