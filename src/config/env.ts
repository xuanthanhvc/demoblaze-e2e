import path from 'node:path';
import dotenv from 'dotenv';
import type { Credentials } from '../data/user';

dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

/** Raised when an environment variable is present but invalid. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(`Invalid configuration: ${message}. See .env.example for documented variables.`);
    this.name = 'ConfigError';
  }
}

function raw(name: string): string | undefined {
  const value = process.env[name];
  return value === undefined || value.trim() === '' ? undefined : value.trim();
}

function readString(name: string, fallback: string): string {
  return raw(name) ?? fallback;
}

function readUrl(name: string, fallback: string): string {
  const value = readString(name, fallback);
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ConfigError(`${name}="${value}" is not a valid absolute URL`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ConfigError(`${name}="${value}" must use http or https`);
  }
  return value.replace(/\/+$/, '');
}

function readInt(name: string, fallback: number, { min = 0 }: { min?: number } = {}): number {
  const value = raw(name);
  if (value === undefined) return fallback;
  if (!/^-?\d+$/.test(value)) {
    throw new ConfigError(`${name}="${value}" must be an integer`);
  }
  const parsed = Number.parseInt(value, 10);
  if (parsed < min) {
    throw new ConfigError(`${name}=${parsed} must be >= ${min}`);
  }
  return parsed;
}

function readBool(name: string, fallback: boolean): boolean {
  const value = raw(name);
  if (value === undefined) return fallback;
  const normalized = value.toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  throw new ConfigError(`${name}="${value}" must be a boolean (true/false/1/0)`);
}

/** Worker count: a positive integer or a percentage such as "50%". */
function readWorkers(name: string): number | string | undefined {
  const value = raw(name);
  if (value === undefined) return undefined;
  if (/^\d+%$/.test(value)) return value;
  if (/^\d+$/.test(value) && Number(value) > 0) return Number(value);
  throw new ConfigError(`${name}="${value}" must be a positive integer or a percentage like "50%"`);
}

function readCredentials(): Credentials | undefined {
  const username = raw('DEMOBLAZE_USERNAME');
  const password = raw('DEMOBLAZE_PASSWORD');
  if (username === undefined && password === undefined) return undefined;
  if (username === undefined || password === undefined) {
    throw new ConfigError('DEMOBLAZE_USERNAME and DEMOBLAZE_PASSWORD must be set together');
  }
  return { username, password };
}

/** Fully resolved, validated runtime configuration. */
export interface EnvConfig {
  /** True when running under a CI system (CI env var is set and not "false"/"0"). */
  readonly isCI: boolean;
  /** Base URL of the web UI. */
  readonly baseUrl: string;
  /** Base URL of the REST backend. */
  readonly apiUrl: string;
  /** Optional pre-existing account; when absent tests sign up fresh users. */
  readonly credentials: Credentials | undefined;
  /** Run browsers headless. */
  readonly headless: boolean;
  /** Parallel workers; undefined lets Playwright decide. */
  readonly workers: number | string | undefined;
  /** Retries per failed test. */
  readonly retries: number;
  /** Timeouts in milliseconds. */
  readonly timeouts: {
    readonly test: number;
    readonly expect: number;
    readonly action: number;
    readonly navigation: number;
    readonly api: number;
  };
  /** Performance budgets in milliseconds. */
  readonly perf: {
    readonly domContentLoadedMs: number;
    readonly loadMs: number;
    readonly apiResponseMs: number;
  };
  /**
   * Retry policy for API setup calls that fail transiently (network, 429, 5xx):
   * extra attempts after the first, and the first backoff delay (doubles per retry).
   */
  readonly apiRetry: { readonly retries: number; readonly baseDelayMs: number };
  /** Skip the API health check in global setup. */
  readonly skipHealthCheck: boolean;
  /** Suffix for the CI blob report file, unique per parallel CI job. */
  readonly blobReportName: string;
}

function loadConfig(): EnvConfig {
  const ci = raw('CI')?.toLowerCase();
  const isCI = ci !== undefined && ci !== 'false' && ci !== '0';
  return Object.freeze({
    isCI,
    baseUrl: readUrl('BASE_URL', 'https://www.demoblaze.com'),
    apiUrl: readUrl('API_URL', 'https://api.demoblaze.com'),
    credentials: readCredentials(),
    headless: readBool('HEADLESS', true),
    workers: readWorkers('WORKERS'),
    retries: readInt('RETRIES', isCI ? 2 : 0),
    timeouts: Object.freeze({
      test: readInt('TEST_TIMEOUT_MS', 60_000, { min: 1000 }),
      expect: readInt('EXPECT_TIMEOUT_MS', 10_000, { min: 100 }),
      action: readInt('ACTION_TIMEOUT_MS', 15_000, { min: 100 }),
      navigation: readInt('NAVIGATION_TIMEOUT_MS', 30_000, { min: 100 }),
      api: readInt('API_TIMEOUT_MS', 15_000, { min: 100 }),
    }),
    perf: Object.freeze({
      domContentLoadedMs: readInt('PERF_DCL_BUDGET_MS', 5_000, { min: 1 }),
      loadMs: readInt('PERF_LOAD_BUDGET_MS', 10_000, { min: 1 }),
      apiResponseMs: readInt('PERF_API_BUDGET_MS', 3_000, { min: 1 }),
    }),
    apiRetry: Object.freeze({ retries: readInt('API_RETRIES', 2), baseDelayMs: 500 }),
    skipHealthCheck: readBool('SKIP_HEALTH_CHECK', false),
    blobReportName: readString('BLOB_REPORT_NAME', 'local').replace(/[^\w.-]/g, '_'),
  });
}

/** Single source of truth for environment-dependent values. */
export const env: EnvConfig = loadConfig();
