import type { Page } from '@playwright/test';
import { Navbar } from '@components/Navbar';

/** Common behavior for every DemoBlaze page. */
export abstract class BasePage {
  /** Navigation bar present on every page. */
  readonly navbar: Navbar;

  protected constructor(readonly page: Page) {
    this.navbar = new Navbar(page);
  }

  /**
   * Opens `path` (relative to the base URL) and returns once the page is
   * ready for interaction (see `Navbar.waitForReady`). Before the `load`
   * event, Firefox can ignore a link click that starts a new navigation.
   */
  protected async navigate(path: string): Promise<void> {
    await this.page.goto(path, { waitUntil: 'load' });
    await this.navbar.waitForReady();
  }
}
