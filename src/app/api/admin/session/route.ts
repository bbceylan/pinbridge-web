import { NextRequest, NextResponse } from 'next/server';

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY_PREFIX = process.env.PINBRIDGE_REDIS_PREFIX || 'pinbridge';
const ADMIN_TOKEN = process.env.ADMIN_SETUP_TOKEN;

async function redisCommand(command: string, args: (string | number)[]) {
  if (!REDIS_URL || !REDIS_TOKEN) {
    throw new Error('Redis is not configured');
  }

  const response = await fetch(REDIS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([command, ...args]),
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Redis error: ${text || response.status}`);
  }

  const data = await response.json();
  return data.result as string | null;
}

export async function POST(request: NextRequest) {
  if (!ADMIN_TOKEN) {
    return NextResponse.json(
      { error: 'Admin setup token is not configured.' },
      { status: 500 }
    );
  }

  const token = request.headers.get('x-admin-token');
  if (token !== ADMIN_TOKEN) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const sessionId = body?.sessionId as string | undefined;
  const userId = body?.userId as string | undefined;
  const role = body?.role as string | undefined;
  const premium = Boolean(body?.premium);
  const ttlSeconds = Number(body?.ttlSeconds ?? 60 * 60 * 24 * 7);

  if (!sessionId || !userId) {
    return NextResponse.json(
      { error: 'sessionId and userId are required.' },
      { status: 400 }
    );
  }

  const payload = JSON.stringify({ userId, role, premium });

  await redisCommand('SETEX', [`${KEY_PREFIX}:session:${sessionId}`, ttlSeconds, payload]);

  return NextResponse.json({ ok: true });
}
