import type { Locator, Page } from '@playwright/test';
import { captureDialog, failOnDialog } from '@utils/dialog';
import { CredentialsModal } from './CredentialsModal';
import { Navbar } from './Navbar';

/** "Log in" Bootstrap modal. */
export class LoginModal extends CredentialsModal {
  readonly title: Locator;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly closeIcon: Locator;
  private readonly navbar: Navbar;

  constructor(page: Page) {
    super(page, 'logInModal');
    this.title = this.root.locator('#logInModalLabel');
    this.usernameInput = this.root.locator('#loginusername');
    this.passwordInput = this.root.locator('#loginpassword');
    this.submitButton = this.root.getByRole('button', { name: 'Log in' });
    this.closeIcon = this.root.locator('.modal-header .close');
    this.navbar = new Navbar(page);
  }

  /** Opens the modal from the navbar "Log in" link and waits until it is ready for input. */
  async open(): Promise<void> {
    await this.openWith(() => this.navbar.loginLink.click());
  }

  /**
   * Logs in with credentials expected to be valid and returns once the page
   * has reloaded into the logged-in state (welcome text visible).
   *
   * @throws DialogRaisedError immediately, with the alert text, if the site
   * rejects the login (e.g. "Wrong password.").
   */
  async login(username: string, password: string): Promise<void> {
    await this.fill(username, password);
    await failOnDialog(
      this.page,
      `Login as "${username}"`,
      () => this.submitButton.click(),
      () => this.navbar.welcomeText.waitFor({ state: 'visible' }),
    );
    // The welcome text only appears in the document the site reloads into after login.
    await this.navbar.waitForReady();
  }

  /**
   * Submits the form when an alert is expected (validation or wrong
   * credentials) and returns the alert message.
   */
  async loginExpectingAlert(username: string, password: string): Promise<string> {
    await this.fill(username, password);
    return captureDialog(this.page, () => this.submitButton.click());
  }
}
