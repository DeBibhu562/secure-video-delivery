import { createHash } from 'crypto';

/**
 * Bunny Stream embed token: sha256_hex(tokenAuthKey + videoId + expires).
 * The CDN recomputes this at the edge, so an expired or edited link stops working
 * without the origin server being involved.
 */
export function signEmbedToken(tokenAuthKey: string, videoId: string, expiresAt: number): string {
  return createHash('sha256').update(`${tokenAuthKey}${videoId}${expiresAt}`).digest('hex');
}

export interface PlayToken {
  token: string;
  expires: number;
  embedUrl: string;
}

/** Short TTL on purpose: a leaked link is only useful for a few minutes. */
export const DEFAULT_TTL_SECONDS = 20 * 60;

export function issuePlayToken(opts: {
  tokenAuthKey: string;
  libraryId: string;
  videoId: string;
  ttlSeconds?: number;
  now?: number; // seconds, for tests
}): PlayToken {
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  const expires = now + (opts.ttlSeconds ?? DEFAULT_TTL_SECONDS);
  const token = signEmbedToken(opts.tokenAuthKey, opts.videoId, expires);
  const embedUrl = `https://iframe.mediadelivery.net/embed/${opts.libraryId}/${opts.videoId}?token=${token}&expires=${expires}`;
  return { token, expires, embedUrl };
}
