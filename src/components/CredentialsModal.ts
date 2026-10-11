import type { Locator } from '@playwright/test';
import { BootstrapModal } from './BootstrapModal';

/**
 * Bootstrap modal with username + password fields (Log in / Sign up).
 * Centralises the shared fill contract so both modals stay in sync.
 */
export abstract class CredentialsModal extends BootstrapModal {
  abstract readonly usernameInput: Locator;
  abstract readonly passwordInput: Locator;

  protected override get readyField(): Locator {
    return this.usernameInput;
  }

  /** Fills the form without submitting. */
  async fill(username: string, password: string): Promise<void> {
    await this.waitForOpen();
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
  }
}
