import { test } from '@playwright/test';

/** Defect identifier from the test case suite, e.g. `BUG-001`. */
export type DefectId = `BUG-${number}`;

/** Options for {@link knownDefect}. */
export interface KnownDefectOptions {
  /**
   * Restrict the expectation to matching runs, e.g.
   * `{ when: browserName === 'chromium' }`. Defaults to always.
   */
  readonly when?: boolean;
}

/**
 * Marks the running test as blocked by a known application defect.
 *
 * Call it after the arrangement, right before the step that exposes the
 * defect. `test.fail()` turns *any* failure into a pass, so a marker at the
 * top would also hide a broken login, a failed API seed or an outage.
 *
 * The test keeps asserting the *correct* behavior and is expected to fail;
 * a `{ type: 'defect', description: '<id> <summary>' }` annotation is added
 * to the report. Once the site fixes the defect the test reports
 * "unexpectedly passed", signalling that the marker must be removed.
 *
 * @example
 * test('TC-ORDER-005 receipt shows today\'s date', { tag: ['@regression', '@order'] }, async ({ ... }) => {
 *   await seedCart([product]);
 *   await cartPage.goto();
 *   knownDefect('BUG-001', 'Purchase confirmation renders a zero-based month');
 *   // action and assertions of the correct behavior
 * });
 */
export function knownDefect(id: DefectId, summary: string, options: KnownDefectOptions = {}): void {
  const { when = true } = options;
  const description = `${id} ${summary}`;
  test.info().annotations.push({ type: 'defect', description });
  test.fail(when, description);
}
