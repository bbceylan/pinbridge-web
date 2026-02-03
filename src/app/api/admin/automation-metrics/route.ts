import { NextRequest, NextResponse } from 'next/server';
import { getAutomationGuardrails } from '@/lib/services/automation-guardrails';
import { getServerSession } from '@/lib/server/auth';

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY_PREFIX = process.env.PINBRIDGE_REDIS_PREFIX || 'pinbridge';

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
  return data.result as any;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(request);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  const tier = url.searchParams.get('tier') === 'premium' ? 'premium' : 'free';
  const clear = url.searchParams.get('clear') === 'true';

  const now = new Date();
  const dayKey = now.toISOString().slice(0, 10);
  const minuteKey = `${dayKey}_${now.getUTCHours().toString().padStart(2, '0')}-${now
    .getUTCMinutes()
    .toString()
    .padStart(2, '0')}`;

  const guardrails = getAutomationGuardrails(tier);

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    return d.toISOString().slice(0, 10);
  });

  if (!userId) {
    let totalDaily = 0;
    let topUsers: Array<{ userId: string; count: number; tier: string }> = [];
    let totalsByTier = { free: 0, premium: 0 };
    let rolling7Days = { free: 0, premium: 0, total: 0 };
    let rolling7DaysSeries: Array<{ date: string; free: number; premium: number; total: number }> = [];

    try {
      const collectTotals = async (tierKey: 'free' | 'premium') => {
        const indexKey = `${KEY_PREFIX}:automation:index:${tierKey}:${dayKey}`;
        const userIds = (await redisCommand('SMEMBERS', [indexKey])) as any;
        const list = Array.isArray(userIds) ? userIds : [];

        if (list.length === 0) return [];

        const keys = list.map(
          (id: string) => `${KEY_PREFIX}:automation:daily:${tierKey}:${id}:${dayKey}`
        );
        const counts = (await redisCommand('MGET', keys)) as any;
        return list.map((id: string, index: number) => ({
          userId: id,
          count: Number(counts?.[index] ?? 0),
          tier: tierKey,
        }));
      };

      const freePairs = await collectTotals('free');
      const premiumPairs = await collectTotals('premium');

      totalsByTier.free = freePairs.reduce((sum, item) => sum + item.count, 0);
      totalsByTier.premium = premiumPairs.reduce((sum, item) => sum + item.count, 0);

      const allPairs = [...freePairs, ...premiumPairs];
      totalDaily = allPairs.reduce((sum, item) => sum + item.count, 0);
      topUsers = allPairs.sort((a, b) => b.count - a.count).slice(0, 5);

      const collectDailyTotals = async (tierKey: 'free' | 'premium') => {
        const results: Record<string, number> = {};
        for (const key of last7Days) {
          const indexKey = `${KEY_PREFIX}:automation:index:${tierKey}:${key}`;
          const userIds = (await redisCommand('SMEMBERS', [indexKey])) as any;
          const list = Array.isArray(userIds) ? userIds : [];
          if (list.length === 0) {
            results[key] = 0;
            continue;
          }

          const keys = list.map(
            (id: string) => `${KEY_PREFIX}:automation:daily:${tierKey}:${id}:${key}`
          );
          const counts = (await redisCommand('MGET', keys)) as any;
          results[key] = keys.reduce((sum, _k, index) => sum + Number(counts?.[index] ?? 0), 0);
        }
        return results;
      };

      const freeDaily = await collectDailyTotals('free');
      const premiumDaily = await collectDailyTotals('premium');

      rolling7DaysSeries = last7Days.map((key) => ({
        date: key,
        free: freeDaily[key] ?? 0,
        premium: premiumDaily[key] ?? 0,
        total: (freeDaily[key] ?? 0) + (premiumDaily[key] ?? 0),
      }));

      rolling7Days.free = rolling7DaysSeries.reduce((sum, item) => sum + item.free, 0);
      rolling7Days.premium = rolling7DaysSeries.reduce((sum, item) => sum + item.premium, 0);
      rolling7Days.total = rolling7Days.free + rolling7Days.premium;
    } catch {
      // ignore aggregate errors
    }

    return NextResponse.json(
      {
        message: 'Provide userId to view counts.',
        guardrails,
        aggregates: {
          totalDaily,
          totalsByTier,
          rolling7Days,
          rolling7DaysSeries,
          topUsers,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  if (clear) {
    try {
      const userIndexKey = `${KEY_PREFIX}:automation:user-index:${tier}:${userId}`;
      const dayKeys = (await redisCommand('SMEMBERS', [userIndexKey])) as any;
      const dayList = Array.isArray(dayKeys) ? dayKeys : [];

      if (dayList.length > 0) {
        const dailyKeys = dayList.map(
          (key: string) => `${KEY_PREFIX}:automation:daily:${tier}:${userId}:${key}`
        );

        const chunkSize = 200;
        for (let i = 0; i < dailyKeys.length; i += chunkSize) {
          const chunk = dailyKeys.slice(i, i + chunkSize);
          await redisCommand('DEL', chunk);
        }

        for (const key of dayList) {
          const indexKey = `${KEY_PREFIX}:automation:index:${tier}:${key}`;
          await redisCommand('SREM', [indexKey, userId]);
        }
      }

      await redisCommand('DEL', [userIndexKey]);

      const minuteKeyName = `${KEY_PREFIX}:automation:minute:${tier}:${userId}:${minuteKey}`;
      await redisCommand('DEL', [minuteKeyName]);
    } catch {
      // ignore
    }

    return NextResponse.json(
      {
        cleared: true,
        userId,
        tier,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const dailyKey = `${KEY_PREFIX}:automation:daily:${tier}:${userId}:${dayKey}`;
  const minuteKeyName = `${KEY_PREFIX}:automation:minute:${tier}:${userId}:${minuteKey}`;

  const dailyCount = Number((await redisCommand('GET', [dailyKey])) || 0);
  const minuteCount = Number((await redisCommand('GET', [minuteKeyName])) || 0);

  let rolling7DaysUser: Array<{ date: string; count: number }> = [];
  try {
    rolling7DaysUser = await Promise.all(
      last7Days.map(async (key) => {
        const count = Number(
          (await redisCommand('GET', [
            `${KEY_PREFIX}:automation:daily:${tier}:${userId}:${key}`,
          ])) || 0
        );
        return { date: key, count };
      })
    );
  } catch {
    rolling7DaysUser = [];
  }

  return NextResponse.json(
    {
      userId,
      tier,
      counts: {
        daily: dailyCount,
        minute: minuteCount,
      },
      caps: {
        daily: guardrails.dailyCap,
        minute: guardrails.perMinuteCap,
      },
      rolling7Days: rolling7DaysUser,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
