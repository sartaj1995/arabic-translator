import { AppError } from "./errors";

/**
 * Sliding-window rate limiter held in module memory.
 *
 * Deliberately dependency-free. On Vercel each lambda instance keeps its own
 * Map and a cold start wipes it, so this is an abuse brake rather than a
 * guarantee — enough to stop a runaway loop from burning your Gemini quota.
 * If you ever share the URL publicly, swap the body of `hit` for Upstash
 * Redis; the call sites do not change.
 */

type Stamps = number[];
const buckets = new Map<string, Stamps>();

/** Drop buckets nobody has touched in a while so the Map cannot grow forever. */
let lastSweep = Date.now();
function sweep(windowMs: number, now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, stamps] of buckets) {
    if (stamps.length === 0 || now - stamps[stamps.length - 1] > windowMs) {
      buckets.delete(key);
    }
  }
}

export interface RateLimitRule {
  /** Requests permitted per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

/** Sensible defaults for a personal app: generous for you, useless for a bot. */
export const SPEAK_LIMIT: RateLimitRule = { limit: 20, windowMs: 60_000 };
export const LISTEN_LIMIT: RateLimitRule = { limit: 20, windowMs: 60_000 };

/**
 * Record a hit for `key`. Throws AppError("RATE_LIMITED") when over budget.
 */
export function hit(key: string, rule: RateLimitRule): void {
  const now = Date.now();
  sweep(rule.windowMs, now);

  const cutoff = now - rule.windowMs;
  const stamps = (buckets.get(key) ?? []).filter((t) => t > cutoff);

  if (stamps.length >= rule.limit) {
    const retryAfter = Math.ceil((stamps[0] + rule.windowMs - now) / 1000);
    buckets.set(key, stamps);
    throw new AppError(
      "RATE_LIMITED",
      `Too many requests. Try again in ${retryAfter}s.`,
      429,
      Math.max(retryAfter, 1),
    );
  }

  stamps.push(now);
  buckets.set(key, stamps);
}

/**
 * Best-effort client identity. Vercel always sets x-forwarded-for; locally
 * there may be nothing, in which case every dev request shares one bucket.
 */
export function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "local";
}
