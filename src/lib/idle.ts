// Sign-out after a period with no requests (Solution Design, Security: sessions).
// Kept free of Next.js so it can be unit tested.

export const IDLE_COOKIE = "fs_last_active";
export const IDLE_LIMIT_MS = 12 * 60 * 60 * 1000; // 12 hours; shared tablets come with the packhouse screens

// True when the last recorded activity is older than the limit. No record means not idle:
// the first request after signing in starts the clock.
export function isIdle(lastActive: string | undefined, now: number, limitMs = IDLE_LIMIT_MS): boolean {
  if (!lastActive) return false;
  const last = Number(lastActive);
  if (!Number.isFinite(last)) return true;
  return now - last > limitMs;
}
