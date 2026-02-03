import 'server-only';

import type { NextRequest } from 'next/server';
import crypto from 'crypto';

export interface ServerSession {
  userId: string;
  role?: string;
  premium?: boolean;
}

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

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

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (padded.length % 4)) % 4;
  const normalized = padded + '='.repeat(padLength);
  return Buffer.from(normalized, 'base64').toString('utf8');
}

function verifyJwt(token: string, secret: string): ServerSession | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;
  const headerJson = base64UrlDecode(headerB64);
  const header = JSON.parse(headerJson);

  if (header?.alg !== 'HS256') return null;

  const data = `${headerB64}.${payloadB64}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  if (expectedSignature !== signatureB64) return null;

  const payloadJson = base64UrlDecode(payloadB64);
  const payload = JSON.parse(payloadJson);

  const expectedIssuer = process.env.PINBRIDGE_JWT_ISSUER;
  const expectedAudience = process.env.PINBRIDGE_JWT_AUDIENCE;

  if (payload?.exp && Date.now() / 1000 > payload.exp) return null;
  if (expectedIssuer && payload?.iss !== expectedIssuer) return null;
  if (expectedAudience) {
    const aud = payload?.aud;
    if (Array.isArray(aud)) {
      if (!aud.includes(expectedAudience)) return null;
    } else if (aud !== expectedAudience) {
      return null;
    }
  }
  if (!payload?.sub && !payload?.userId) return null;

  return {
    userId: String(payload.sub || payload.userId),
    role: payload.role,
    premium: Boolean(payload.premium || payload.isPremium),
  };
}

function getJwtFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return request.cookies.get('pinbridge_jwt')?.value || null;
}

function getSessionIdFromRequest(request: NextRequest): string | null {
  return (
    request.cookies.get('pinbridge_session')?.value ||
    request.cookies.get('pb_session')?.value ||
    null
  );
}

function getFallbackUserId(request: NextRequest): string {
  const cookieUserId = request.cookies.get('pinbridge_user_id')?.value;
  if (cookieUserId) return cookieUserId;

  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'anon';
  }

  return request.ip || 'anon';
}

export async function getServerSession(request: NextRequest): Promise<ServerSession | null> {
  const jwtSecret = process.env.PINBRIDGE_JWT_SECRET;
  if (jwtSecret) {
    const jwt = getJwtFromRequest(request);
    if (jwt) {
      try {
        const session = verifyJwt(jwt, jwtSecret);
        if (session) return session;
      } catch {
        // ignore JWT errors and fall back to Redis session
      }
    }
  }

  const sessionId = getSessionIdFromRequest(request);
  if (!sessionId) return null;

  try {
  const keyPrefix = process.env.PINBRIDGE_REDIS_PREFIX || 'pinbridge';
  const raw = await redisCommand('GET', [`${keyPrefix}:session:${sessionId}`]);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as ServerSession;
    if (!parsed?.userId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function getServerUserContext(request: NextRequest): Promise<ServerSession> {
  const session = await getServerSession(request);
  if (session) return session;

  return {
    userId: getFallbackUserId(request),
    premium: false,
  };
}
