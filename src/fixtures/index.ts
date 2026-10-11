import { expect } from '@playwright/test';
import { test } from './pages';

/**
 * Project-wide `test` with dialog guard, API client, data factories, browser
 * session and page objects. Specs must import `test` and `expect` from here.
 *
 * Composition (SRP): dialogGuard → api → auth → pages.
 */
export { test, expect };
export { knownDefect, type DefectId, type KnownDefectOptions } from './defects';
export type {
  AuthenticatedUser,
  BrowserSession,
  FrameworkOptions,
  SeedCart,
  UserFactory,
} from './types';
export type { Credentials } from '@data/user';
