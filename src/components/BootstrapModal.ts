import type { Locator, Page } from '@playwright/test';

interface JQueryLike {
  (selector: string): { length: number; one(event: string, handler: () => void): void };
}

type ShownFlags = Record<string, boolean | undefined>;

let sequence = 0;

/**
 * Shared lifecycle for Bootstrap modals on DemoBlaze (open / ready / close).
 * Subclasses pass their element id and own their form locators; this base
 * owns the timing contract so every modal waits for the same "shown" and
 * "fully hidden" signals.
 */
export abstract class BootstrapModal {
  readonly root: Locator;
  /** Footer "Close" button. */
  readonly closeButton: Locator;

  /**
   * Field that becomes interactable once Bootstrap has finished showing the modal.
   * Declared as an accessor, not a field: Playwright's Babel transform emits an
   * abstract field as `this.readyField = undefined` in this constructor, which
   * throws against the subclasses' getters.
   */
  protected abstract get readyField(): Locator;

  protected constructor(
    protected readonly page: Page,
    private readonly modalId: string,
  ) {
    this.root = page.locator(`#${modalId}`);
    this.closeButton = this.root.locator('.modal-footer').getByRole('button', { name: 'Close' });
  }

  /**
   * Runs `trigger` (the click that opens this modal) and resolves once the
   * site's Bootstrap fires `shown.bs.modal` for it.
   *
   * Bootstrap moves focus to the modal when its show transition ends; typing
   * before that can lose the input. Waiting for the site's own event removes
   * the race without any fixed delay.
   */
  async openWith(trigger: () => Promise<unknown>): Promise<void> {
    sequence += 1;
    const flag = `__qaModalShown_${this.modalId}_${sequence}`;
    await this.page.evaluate(
      ({ id, key }) => {
        const win = window as unknown as { jQuery?: JQueryLike; __qaModalShown?: ShownFlags };
        const modal = win.jQuery?.(`#${id}`);
        if (!modal || modal.length === 0) {
          throw new Error(`Bootstrap modal #${id} (or jQuery) not found on the page`);
        }
        const flags = (win.__qaModalShown ??= {});
        flags[key] = false;
        modal.one('shown.bs.modal', () => {
          flags[key] = true;
        });
      },
      { id: this.modalId, key: flag },
    );
    await trigger();
    await this.page.waitForFunction(
      (key) =>
        (window as unknown as { __qaModalShown?: ShownFlags }).__qaModalShown?.[key] === true,
      flag,
    );
  }

  /** Waits until the modal is shown and ready for input. */
  async waitForOpen(): Promise<void> {
    await this.readyField.waitFor({ state: 'visible' });
  }

  /** Waits until the modal is fully hidden. */
  async waitForClosed(): Promise<void> {
    await this.root.waitFor({ state: 'hidden' });
  }

  /** Closes the modal with the footer "Close" button. */
  async close(): Promise<void> {
    await this.closeButton.click();
    await this.waitForClosed();
  }
}
