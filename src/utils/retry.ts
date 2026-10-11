import { setTimeout as delay } from 'node:timers/promises';

/** Settings for {@link withRetry}. */
export interface RetryOptions {
  /** Extra attempts after the first one (0 disables retrying). */
  readonly retries: number;
  /** Delay before the first retry; doubles on every further retry. */
  readonly baseDelayMs: number;
  /** Upper bound for a single delay. */
  readonly maxDelayMs?: number;
  /** Decides whether a failed attempt may be retried. */
  readonly isRetryable: (outcome: RetryOutcome) => boolean;
  /** Called before each retry, e.g. to annotate the test. */
  readonly onRetry?: (outcome: RetryOutcome, attempt: number, delayMs: number) => void;
}

/** HTTP statuses worth retrying on a shared public backend: rate limiting and server errors. */
export function isTransientStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/** Result of one attempt: either a value or a thrown error. */
export type RetryOutcome = { readonly error: unknown } | { readonly value: unknown };

/**
 * Runs `operation`, retrying with exponential backoff while `isRetryable`
 * approves the outcome. Intended for test-data setup against an unreliable
 * backend, not for waiting on UI state.
 */
export async function withRetry<T>(operation: () => Promise<T>, options: RetryOptions): Promise<T> {
  const { retries, baseDelayMs, maxDelayMs = 5_000, isRetryable, onRetry } = options;
  for (let attempt = 0; ; attempt += 1) {
    let outcome: RetryOutcome;
    try {
      const value = await operation();
      outcome = { value };
      if (attempt >= retries || !isRetryable(outcome)) return value;
    } catch (error) {
      outcome = { error };
      if (attempt >= retries || !isRetryable(outcome)) throw error;
    }
    const delayMs = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
    onRetry?.(outcome, attempt + 1, delayMs);
    await delay(delayMs);
  }
}
