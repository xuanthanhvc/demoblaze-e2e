import type { Dialog, Page } from '@playwright/test';

/**
 * Native dialog handling. Every expected dialog goes through one of three
 * helpers, all armed before the triggering action:
 *
 * - {@link captureDialog}: the action raises exactly one dialog; returns its message.
 * - {@link collectDialogs}: the action raises several dialogs; assert the list afterwards.
 * - {@link failOnDialog}: the action must succeed; a dialog fails the step at once.
 *
 * Any other dialog is unexpected and fails the test (see the `context`
 * fixture in `src/fixtures/dialogGuard.ts`).
 */

/** Information captured from a native browser dialog. */
export interface DialogInfo {
  /** Dialog kind: alert, confirm, prompt or beforeunload. */
  readonly type: string;
  /** Message text shown by the dialog. */
  readonly message: string;
}

/** Dialogs recorded by {@link collectDialogs}, in the order they opened. */
export interface DialogCollector {
  readonly messages: readonly string[];
}

const pendingExpectations = new WeakMap<Page, number>();

/**
 * True while a helper of this module is listening for dialogs on `page`.
 * Used by the unexpected-dialog guard to ignore expected dialogs.
 */
export function isDialogExpected(page: Page): boolean {
  return (pendingExpectations.get(page) ?? 0) > 0;
}

function changeExpectation(page: Page, delta: number): void {
  const next = (pendingExpectations.get(page) ?? 0) + delta;
  if (next <= 0) pendingExpectations.delete(page);
  else pendingExpectations.set(page, next);
}

/**
 * Marks dialogs on `page` as expected and accepts each one as soon as it
 * opens: a dialog raised synchronously inside a click handler blocks that
 * click until it is closed. Returns the function that stops listening.
 */
function listen(page: Page, onDialog: (info: DialogInfo) => void): () => void {
  const handler = (dialog: Dialog): void => {
    onDialog({ type: dialog.type(), message: dialog.message() });
    dialog.accept().catch(() => undefined);
  };
  changeExpectation(page, 1);
  page.on('dialog', handler);
  return () => {
    page.off('dialog', handler);
    changeExpectation(page, -1);
  };
}

/**
 * Runs `action` and returns the message of the native dialog it triggers.
 * Dialogs raised asynchronously (e.g. after an XHR) are never missed.
 *
 * @example
 * expect(await captureDialog(page, () => addButton.click())).toBe(UI_ALERTS.productAdded);
 */
export async function captureDialog(page: Page, action: () => Promise<unknown>): Promise<string> {
  const stop = listen(page, () => undefined);
  try {
    const opened = page.waitForEvent('dialog');
    const [dialog] = await Promise.all([opened, action()]);
    return dialog.message();
  } finally {
    stop();
  }
}

/**
 * Records every dialog `page` raises from now until the end of the test, for
 * actions that raise several (e.g. rapid repeated clicks). Poll the result:
 *
 * @example
 * const dialogs = collectDialogs(page);
 * await button.click({ clickCount: 3 });
 * await expect.poll(() => dialogs.messages).toEqual([msg, msg, msg]);
 */
export function collectDialogs(page: Page): DialogCollector {
  const messages: string[] = [];
  listen(page, ({ message }) => messages.push(message));
  return { messages };
}

/** Thrown by {@link failOnDialog} when a dialog opens instead of the expected outcome. */
export class DialogRaisedError extends Error {
  constructor(
    readonly step: string,
    readonly dialog: DialogInfo,
  ) {
    super(`${step} failed: the page raised ${dialog.type} "${dialog.message}"`);
    this.name = 'DialogRaisedError';
  }
}

/**
 * Runs `action`, then waits for `outcome` (e.g. a success element). If the
 * page opens a dialog first, the dialog is accepted and a
 * {@link DialogRaisedError} carrying its message is thrown immediately,
 * instead of letting `outcome` time out.
 *
 * @param step Human-readable name of the step, used in the error message.
 */
export async function failOnDialog<T>(
  page: Page,
  step: string,
  action: () => Promise<unknown>,
  outcome: () => Promise<T>,
): Promise<T> {
  let stop: () => void = () => undefined;
  const dialogRaised = new Promise<DialogInfo>((resolve) => {
    stop = listen(page, resolve);
  });
  const succeeded = (async () => {
    await action();
    return outcome();
  })();
  // When the dialog wins the race, the pending outcome must not surface as an unhandled rejection.
  succeeded.catch(() => undefined);
  try {
    const winner = await Promise.race([
      succeeded.then((value) => ({ value })),
      dialogRaised.then((dialog) => ({ dialog })),
    ]);
    if ('dialog' in winner) throw new DialogRaisedError(step, winner.dialog);
    return winner.value;
  } finally {
    stop();
  }
}
