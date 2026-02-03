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
        case 'PING':
          return 'PONG';
        case 'GET': {
          const key = String(args[0]);
          return strings.get(key) ?? null;
        }
        default:
          return 'OK';
      }
    },
    setString(key: string, value: string) {
      strings.set(key, value);
    },
  };
}

describe('GET /api/admin/automation-status', () => {
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

  it('returns status for admin session', async () => {
    const { GET } = await import('../automation-status/route');

    const tokenPayload = {
      sub: 'admin',
      role: 'admin',
      premium: true,
      iss: 'pinbridge',
      aud: 'pinbridge-web',
      exp: Math.floor(Date.now() / 1000) + 60,
    };
    const token = createJwt(tokenPayload, 'test-secret');

    const request = new NextRequest('http://localhost/api/admin/automation-status', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const response = await GET(request);
    const payload = await response.json();

    expect(payload.redis).toBeDefined();
    expect(payload.guardrails).toBeDefined();
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
