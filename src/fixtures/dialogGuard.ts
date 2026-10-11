import { test as base } from '@playwright/test';
import { isDialogExpected, type DialogInfo } from '@utils/dialog';

/**
 * Unexpected-dialog safety net. Dialogs armed through `src/utils/dialog.ts`
 * (captureDialog, collectDialogs, failOnDialog) are ignored; any other dialog
 * is dismissed, attached to the report and fails the test in teardown.
 */
export const test = base.extend({
  context: async ({ context }, use, testInfo) => {
    const unexpected: DialogInfo[] = [];
    context.on('dialog', (dialog) => {
      const owner = dialog.page();
      if (owner && isDialogExpected(owner)) return;
      unexpected.push({ type: dialog.type(), message: dialog.message() });
      dialog.dismiss().catch(() => undefined);
    });

    await use(context);

    if (unexpected.length === 0) return;
    await testInfo.attach('unexpected-dialogs', {
      body: JSON.stringify(unexpected, null, 2),
      contentType: 'application/json',
    });
    const summary = unexpected.map((d) => `[${d.type}] "${d.message}"`).join(', ');
    throw new Error(
      `Unexpected browser dialog(s): ${summary}. ` +
        'Arm the triggering action with captureDialog(), collectDialogs() or failOnDialog().',
    );
  },
});
