/**
 * Shared retry wrapper for Anthropic API calls across the llms101 pipeline.
 *
 * Retries on transient errors only: 529 (Overloaded), 429 (Rate Limit),
 * 500/502/503 (server errors), and network-level failures (no status code).
 * Never retries on 400/401/403/404 — those are bugs or config problems.
 *
 * 3 attempts total with exponential backoff + ±20% jitter:
 *   attempt 1 wait: ~30s   (24–36s)
 *   attempt 2 wait: ~90s   (72–108s)
 *   attempt 3 wait: ~270s  (216–324s) — not reached; failure thrown after attempt 3
 * Retry-After headers are honoured when present (the wait is the larger value).
 *
 * Every retry logs loudly: the caller label, attempt N/3, status, and wait
 * so that a run that succeeds on retry is clearly visible in the CI log.
 */

const TRANSIENT_STATUSES = new Set([429, 500, 502, 503, 529]);
const BASE_DELAYS_MS = [30_000, 90_000, 270_000]; // per-attempt wait, before jitter
const MAX_ATTEMPTS = 3;

export function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * @param {() => Promise<T>} fn      — the API call to attempt
 * @param {string}           label   — human-readable label for log messages
 * @param {{ log?: (msg:string)=>void }} [opts]
 * @returns {Promise<T>}
 */
export async function callWithRetry(fn, label, { log = console.log } = {}) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err.status ?? err.statusCode ?? null;
      const isTransient = status === null || TRANSIENT_STATUSES.has(status);

      if (!isTransient) throw err;          // bug / config — fail immediately
      if (attempt === MAX_ATTEMPTS) throw err; // exhausted — propagate to caller

      let waitMs = BASE_DELAYS_MS[attempt - 1] * (0.8 + Math.random() * 0.4);

      // Honour Retry-After if the API sends one.
      const retryAfter = err.headers?.['retry-after'] ?? err.response?.headers?.['retry-after'];
      if (retryAfter) {
        const secs = parseFloat(retryAfter);
        if (!isNaN(secs)) waitMs = Math.max(waitMs, secs * 1000);
      }

      const waitSec = Math.round(waitMs / 1000);
      log(`[${new Date().toISOString()}] RETRY ${attempt}/${MAX_ATTEMPTS} — "${label}" failed with ${status !== null ? `HTTP ${status}` : 'network error'}. Waiting ${waitSec}s before next attempt.`);
      await sleep(waitMs);
    }
  }
}
