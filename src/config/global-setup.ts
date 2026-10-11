import type { FullConfig } from '@playwright/test';
import { isTransientStatus, withRetry } from '../utils/retry';
import { env } from './env';

type Probe =
  | { readonly ok: true }
  | { readonly ok: false; readonly detail: string; readonly transient: boolean };

function isTransientFailure(probe: Probe): boolean {
  return !probe.ok && probe.transient;
}

async function probe(url: string): Promise<Probe> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(env.timeouts.api) });
    if (!response.ok) {
      return {
        ok: false,
        detail: `HTTP ${response.status} ${response.statusText}`,
        transient: isTransientStatus(response.status),
      };
    }
    const body = (await response.json()) as { Items?: unknown[] };
    if (Array.isArray(body.Items) && body.Items.length > 0) return { ok: true };
    return { ok: false, detail: 'response contained no products', transient: false };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
      transient: true,
    };
  }
}

/**
 * Fails fast with a clear message when the backend is unreachable, instead of
 * letting every test time out individually. Transient failures (network,
 * HTTP 429/5xx) get the same bounded retries as API test-data calls, so one
 * blip on the public site does not abort the whole run.
 */
export default async function globalSetup(_config: FullConfig): Promise<void> {
  if (env.skipHealthCheck) return;
  const url = `${env.apiUrl}/entries`;
  const result = await withRetry(() => probe(url), {
    ...env.apiRetry,
    isRetryable: (outcome) => 'value' in outcome && isTransientFailure(outcome.value as Probe),
  });
  if (result.ok) return;
  throw new Error(
    `Health check failed: GET ${url} -> ${result.detail}. ` +
      'Check API_URL / network access, or set SKIP_HEALTH_CHECK=true to bypass.',
  );
}
