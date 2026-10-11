import type { Locator, Page } from '@playwright/test';
import { captureDialog } from '@utils/dialog';
import { CredentialsModal } from './CredentialsModal';
import { Navbar } from './Navbar';

/** "Sign up" Bootstrap modal. */
export class SignUpModal extends CredentialsModal {
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  private readonly navbar: Navbar;

  constructor(page: Page) {
    super(page, 'signInModal');
    this.usernameInput = this.root.locator('#sign-username');
    this.passwordInput = this.root.locator('#sign-password');
    this.submitButton = this.root.getByRole('button', { name: 'Sign up' });
    this.navbar = new Navbar(page);
  }

  /** Opens the modal from the navbar "Sign up" link and waits until it is ready for input. */
  async open(): Promise<void> {
    await this.openWith(() => this.navbar.signUpLink.click());
  }

  /** Submits the form and returns the resulting alert message (success or error). */
  async signUp(username: string, password: string): Promise<string> {
    await this.fill(username, password);
    return captureDialog(this.page, () => this.submitButton.click());
  }
}
