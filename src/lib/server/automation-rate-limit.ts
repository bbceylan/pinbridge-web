import 'server-only';

import type { NextRequest } from 'next/server';
import { getAutomationGuardrails } from '@/lib/services/automation-guardrails';
import type { SubscriptionTier } from '@/lib/services/automation-guardrails';
import { getServerUserContext } from './auth';

interface RateLimitResult {
  allowed: boolean;
  reason?: 'daily' | 'minute';
  retryAfterSeconds?: number;
  remaining?: {
    daily: number;
    minute: number;
  };
}

const getRedisConfig = () => ({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
  prefix: process.env.PINBRIDGE_REDIS_PREFIX || 'pinbridge',
});

async function redisCommand(command: string, args: (string | number)[]) {
  const { url, token } = getRedisConfig();
  if (!url || !token) {
    throw new Error('Redis is not configured');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
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
  return data.result as number;
}

async function incrementWithTTL(key: string, ttlSeconds: number): Promise<number> {
  const count = await redisCommand('INCR', [key]);
  if (count === 1) {
    await redisCommand('EXPIRE', [key, ttlSeconds]);
  }
  return count;
}

export async function enforceAutomationRateLimit(request: NextRequest): Promise<RateLimitResult> {
  const userContext = await getServerUserContext(request);
  const tier: SubscriptionTier = userContext.premium ? 'premium' : 'free';
  const guardrails = getAutomationGuardrails(tier);
  const userId = userContext.userId;
  const { url, token, prefix } = getRedisConfig();

  if (!url || !token) {
    return { allowed: false, reason: 'daily', retryAfterSeconds: 3600 };
  }

  const now = new Date();
  const dayKey = now.toISOString().slice(0, 10);
  const minuteKey = `${dayKey}_${now.getUTCHours().toString().padStart(2, '0')}-${now
    .getUTCMinutes()
    .toString()
    .padStart(2, '0')}`;

  const dailyKey = `${prefix}:automation:daily:${tier}:${userId}:${dayKey}`;
  const minuteKeyName = `${prefix}:automation:minute:${tier}:${userId}:${minuteKey}`;
  const dailyIndexKey = `${prefix}:automation:index:${tier}:${dayKey}`;
  const userIndexKey = `${prefix}:automation:user-index:${tier}:${userId}`;

  const dailyCount = await incrementWithTTL(dailyKey, 24 * 60 * 60);
  await redisCommand('SADD', [dailyIndexKey, userId]);
  await redisCommand('EXPIRE', [dailyIndexKey, 24 * 60 * 60]);
  await redisCommand('SADD', [userIndexKey, dayKey]);
  await redisCommand('EXPIRE', [userIndexKey, 8 * 24 * 60 * 60]);

  const minuteCount = await incrementWithTTL(minuteKeyName, 60);
  if (minuteCount > guardrails.perMinuteCap) {
    return {
      allowed: false,
      reason: 'minute',
      retryAfterSeconds: 60,
      remaining: {
        daily: Math.max(guardrails.dailyCap - dailyCount, 0),
        minute: Math.max(guardrails.perMinuteCap - minuteCount, 0),
      },
    };
  }

  if (dailyCount > guardrails.dailyCap) {
    const nextReset = new Date();
    nextReset.setUTCHours(24, 0, 0, 0);
    const retryAfterSeconds = Math.max(
      Math.ceil((nextReset.getTime() - now.getTime()) / 1000),
      60
    );
    return {
      allowed: false,
      reason: 'daily',
      retryAfterSeconds,
      remaining: {
        daily: Math.max(guardrails.dailyCap - dailyCount, 0),
        minute: guardrails.perMinuteCap,
      },
    };
  }

  return {
    allowed: true,
    remaining: {
      daily: Math.max(guardrails.dailyCap - dailyCount, 0),
      minute: Math.max(guardrails.perMinuteCap - minuteCount, 0),
    },
  };
}
