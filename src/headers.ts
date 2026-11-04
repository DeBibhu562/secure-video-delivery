/** Headers for play-token and player responses: never cache a token, never allow framing elsewhere. */
export const PLAYBACK_HEADERS: Readonly<Record<string, string>> = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  Pragma: 'no-cache',
  Expires: '0',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

/** Express-style middleware. */
export const playbackHeaders = (_req: unknown, res: { setHeader(k: string, v: string): void }, next: () => void) => {
  for (const [k, v] of Object.entries(PLAYBACK_HEADERS)) res.setHeader(k, v);
  next();
};
