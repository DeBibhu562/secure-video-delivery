import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'crypto';
import { issuePlayToken, checkAccess, allowTokenRequest, ZsetClient, ZsetPipeline } from '../src';

test('play token matches the CDN hash and expires after the TTL', () => {
  const t = issuePlayToken({ tokenAuthKey: 'k', libraryId: '123', videoId: 'v1', ttlSeconds: 1200, now: 1000 });
  assert.equal(t.expires, 2200);
  assert.equal(t.token, createHash('sha256').update('kv12200').digest('hex'));
  assert.match(t.embedUrl, /\/embed\/123\/v1\?token=[0-9a-f]{64}&expires=2200$/);
});

test('free videos are always allowed', () => {
  assert.deepEqual(checkAccess({ id: 'v', requiredPlans: [], order: 5 }, { activePlans: [], completedUpTo: 0, watchCount: 0 }), { allowed: true });
});

test('paid video needs a matching plan', () => {
  const r = checkAccess({ id: 'v', requiredPlans: ['pro'], order: 1 }, { activePlans: ['basic'], completedUpTo: 0, watchCount: 0 });
  assert.deepEqual(r, { allowed: false, reason: 'no_plan' });
});

test('lessons unlock in order', () => {
  const v = { id: 'v', requiredPlans: ['pro'], order: 3 };
  assert.deepEqual(checkAccess(v, { activePlans: ['pro'], completedUpTo: 1, watchCount: 0 }), { allowed: false, reason: 'locked' });
  assert.equal(checkAccess(v, { activePlans: ['pro'], completedUpTo: 2, watchCount: 0 }).allowed, true);
});

test('watch limit is enforced', () => {
  const v = { id: 'v', requiredPlans: ['pro'], order: 1, maxWatches: 3 };
  assert.deepEqual(checkAccess(v, { activePlans: ['pro'], completedUpTo: 0, watchCount: 1 }), { allowed: true, remainingWatches: 2 });
  assert.deepEqual(checkAccess(v, { activePlans: ['pro'], completedUpTo: 0, watchCount: 3 }), { allowed: false, reason: 'watch_limit' });
});

/** Minimal in-memory stand-in for the four sorted-set commands the limiter uses. */
function fakeRedis(): ZsetClient {
  const sets = new Map<string, Map<string, number>>();
  return {
    multi() {
      const ops: Array<() => unknown> = [];
      const p: ZsetPipeline = {
        zremrangebyscore(k, min, max) { ops.push(() => { const s = sets.get(k); if (s) for (const [m, sc] of s) if (sc >= min && sc <= max) s.delete(m); return 0; }); return p; },
        zadd(k, sc, m) { ops.push(() => { if (!sets.has(k)) sets.set(k, new Map()); sets.get(k)!.set(m, sc); return 1; }); return p; },
        zcard(k) { ops.push(() => sets.get(k)?.size ?? 0); return p; },
        pexpire() { ops.push(() => 1); return p; },
        async exec() { return ops.map((f) => [null, f()] as [null, unknown]); },
      };
      return p;
    },
  };
}

test('token rate limit: 10 per minute, then blocked, then the window slides', async () => {
  const r = fakeRedis();
  for (let i = 0; i < 10; i++) assert.equal((await allowTokenRequest(r, 'u1', { now: 1000 + i })).allowed, true);
  assert.equal((await allowTokenRequest(r, 'u1', { now: 1011 })).allowed, false);
  assert.equal((await allowTokenRequest(r, 'u2', { now: 1011 })).allowed, true, 'other users unaffected');
  assert.equal((await allowTokenRequest(r, 'u1', { now: 1000 + 60_011 })).allowed, true, 'old requests fall out of the window');
});
