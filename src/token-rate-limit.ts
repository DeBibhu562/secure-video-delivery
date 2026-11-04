/**
 * Sliding-window log limiter for the play-token endpoint, stored in a Redis sorted set
 * so the limit holds across every API instance (an in-process Map only limits one instance).
 *
 * Each request is a ZSET member scored by its timestamp. Old members are trimmed,
 * the remaining count is compared with the limit, and the key expires on its own when idle.
 */
export interface ZsetPipeline {
  zremrangebyscore(key: string, min: number, max: number): ZsetPipeline;
  zadd(key: string, score: number, member: string): ZsetPipeline;
  zcard(key: string): ZsetPipeline;
  pexpire(key: string, ms: number): ZsetPipeline;
  exec(): Promise<Array<[Error | null, unknown]> | null>;
}

/** Matches ioredis: `redis.multi()` returns a chainable MULTI/EXEC pipeline. */
export interface ZsetClient {
  multi(): ZsetPipeline;
}

export async function allowTokenRequest(
  redis: ZsetClient,
  userId: string,
  opts: { limit?: number; windowMs?: number; now?: number } = {},
): Promise<{ allowed: boolean; count: number }> {
  const limit = opts.limit ?? 10;
  const windowMs = opts.windowMs ?? 60_000;
  const now = opts.now ?? Date.now();
  const key = `play_token_rl:${userId}`;
  const res = await redis
    .multi()
    .zremrangebyscore(key, 0, now - windowMs)
    .zadd(key, now, `${now}:${Math.random().toString(36).slice(2, 8)}`)
    .zcard(key)
    .pexpire(key, windowMs)
    .exec();
  const count = Number(res?.[2]?.[1] ?? 0);
  return { allowed: count <= limit, count };
}
