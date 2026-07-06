import { timingSafeEqual } from 'node:crypto';

/** Constant-time comparison of the presented token against the session token. */
export function tokenMatches(presented: string, expected: string): boolean {
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
