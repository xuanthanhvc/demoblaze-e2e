import type { Locator, Page } from '@playwright/test';
import { HOME_REDIRECT_URL } from '@pages/routes';
import { SESSION_COOKIE } from '@utils/session';

/** Top navigation bar shared by every page. */
export class Navbar {
  readonly root: Locator;
  readonly brand: Locator;
  readonly homeLink: Locator;
  readonly contactLink: Locator;
  readonly aboutUsLink: Locator;
  readonly cartLink: Locator;
  readonly loginLink: Locator;
  readonly logoutLink: Locator;
  readonly signUpLink: Locator;
  /** "Welcome <username>" link, visible only when logged in. */
  readonly welcomeText: Locator;

  constructor(private readonly page: Page) {
    this.root = page.locator('#navbarExample');
    this.brand = page.locator('#nava');
    this.homeLink = this.root.getByRole('link', { name: /^Home/ });
    this.contactLink = this.root.getByRole('link', { name: 'Contact', exact: true });
    this.aboutUsLink = this.root.getByRole('link', { name: 'About us', exact: true });
    this.cartLink = this.root.getByRole('link', { name: 'Cart', exact: true });
    this.loginLink = page.locator('#login2');
    this.logoutLink = page.locator('#logout2');
    this.signUpLink = page.locator('#signin2');
    this.welcomeText = page.locator('#nameofuser');
  }

  /**
   * Waits until the current document can take navbar clicks: its `load`
   * event has fired and the navbar shows its final session state.
   *
   * The markup starts in the logged-out layout. With a session cookie the
   * site swaps in "Welcome …" / "Log out" only after its `/check` request,
   * which can finish after `load`; the right-aligned links then shift, so a
   * click aimed before the swap can miss its target.
   */
  async waitForReady(): Promise<void> {
    await this.page.waitForLoadState('load');
    const cookies = await this.page.context().cookies(this.page.url());
    const loggedIn = cookies.some((c) => c.name === SESSION_COOKIE && c.value !== '');
    await (loggedIn ? this.logoutLink : this.loginLink).waitFor({ state: 'visible' });
  }

  /**
   * Logs out and returns once the site's redirect to `index.html` has loaded
   * and the navbar shows the logged-out state.
   *
   * The link's `href="#"` first produces a fragment-only navigation on the
   * current page; only the later document navigation counts.
   */
  async logout(): Promise<void> {
    await Promise.all([this.waitForDocumentNavigation(HOME_REDIRECT_URL), this.logoutLink.click()]);
    await this.loginLink.waitFor({ state: 'visible' });
    await this.welcomeText.waitFor({ state: 'hidden' });
  }

  /**
   * Resolves when the main frame commits a new document whose path matches
   * `path` and that document is {@link waitForReady | ready}. Fragment-only
   * changes (`...#`) are ignored. Must be armed before the click.
   */
  private async waitForDocumentNavigation(path: RegExp): Promise<void> {
    await this.page.waitForEvent('framenavigated', (frame) => {
      if (frame !== this.page.mainFrame() || frame.url().includes('#')) return false;
      return path.test(new URL(frame.url()).pathname);
    });
    await this.waitForReady();
  }
}
