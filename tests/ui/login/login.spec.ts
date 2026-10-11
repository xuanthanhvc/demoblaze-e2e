import type { Page } from '@playwright/test';
import { ENDPOINTS, isApiRequest } from '@api/requests';
import { UI_ALERTS, welcomeText } from '@data/messages';
import { expect, knownDefect, test, type Credentials, type UserFactory } from '@fixtures';
import { uniqueUsername } from '@utils/data';
import { collectDialogs } from '@utils/dialog';

const WHITESPACE = '   ';
const WRONG_PASSWORD = 'wrong';

/** Records every login request the page sends from now on. */
function recordLoginRequests(page: Page): string[] {
  const urls: string[] = [];
  page.on('request', (request) => {
    if (isApiRequest(request, ENDPOINTS.login)) urls.push(request.url());
  });
  return urls;
}

test.describe('Login', () => {
  test.beforeEach(async ({ homePage }) => {
    await homePage.goto();
  });

  test(
    'TC-LOGIN-001 registered user logs in with valid credentials',
    { tag: ['@smoke', '@regression', '@ui', '@login'] },
    async ({ navbar, loginModal, validCredentials }) => {
      await loginModal.open();
      await loginModal.login(validCredentials.username, validCredentials.password);

      await expect(loginModal.root).toBeHidden();
      await expect(navbar.welcomeText).toHaveText(welcomeText(validCredentials.username));
    },
  );

  test(
    'TC-LOGIN-002 navbar reflects the logged-in state',
    { tag: ['@smoke', '@regression', '@ui', '@login'] },
    async ({ navbar, loginModal, validCredentials }) => {
      await loginModal.open();
      await loginModal.login(validCredentials.username, validCredentials.password);

      await expect(navbar.welcomeText).toHaveText(welcomeText(validCredentials.username));
      await expect(navbar.logoutLink).toBeVisible();
      await expect(navbar.loginLink).toBeHidden();
      await expect(navbar.signUpLink).toBeHidden();
    },
  );

  test(
    'TC-LOGIN-003 login modal opens with title, username and password fields',
    { tag: ['@regression', '@ui', '@login'] },
    async ({ loginModal }) => {
      await loginModal.open();

      await expect(loginModal.title).toHaveText('Log in');
      await expect(loginModal.usernameInput).toBeVisible();
      await expect(loginModal.usernameInput).toHaveValue('');
      await expect(loginModal.passwordInput).toBeVisible();
      await expect(loginModal.passwordInput).toHaveValue('');
      await expect(loginModal.submitButton).toBeVisible();
      await expect(loginModal.closeButton).toBeVisible();
    },
  );

  const EMPTY_FIELD_CASES: readonly {
    readonly id: string;
    readonly title: string;
    readonly tag: readonly string[];
    readonly resolve: (userFactory: UserFactory) => Promise<Credentials>;
  }[] = [
    {
      id: 'TC-LOGIN-004',
      title: 'login with both fields empty is rejected',
      tag: ['@smoke', '@regression', '@ui', '@login'],
      resolve: async () => ({ username: '', password: '' }),
    },
    {
      id: 'TC-LOGIN-005',
      title: 'login with empty password is rejected',
      tag: ['@regression', '@ui', '@login'],
      resolve: async (userFactory) => {
        const { username } = await userFactory.create('login');
        return { username, password: '' };
      },
    },
    {
      id: 'TC-LOGIN-006',
      title: 'login with empty username is rejected',
      tag: ['@regression', '@ui', '@login'],
      resolve: async (userFactory) => {
        const { password } = await userFactory.create('login');
        return { username: '', password };
      },
    },
  ];

  for (const { id, title, tag, resolve } of EMPTY_FIELD_CASES) {
    test(`${id} ${title}`, { tag: [...tag] }, async ({ navbar, loginModal, userFactory }) => {
      const { username, password } = await resolve(userFactory);
      await loginModal.open();

      expect(await loginModal.loginExpectingAlert(username, password)).toBe(
        UI_ALERTS.fillLoginFields,
      );
      await expect(loginModal.root).toBeVisible();
      await expect(navbar.welcomeText).toBeHidden();
    });
  }

  test(
    'TC-LOGIN-007 whitespace-only username and password are treated as empty',
    { tag: ['@regression', '@ui', '@login'] },
    async ({ loginModal }) => {
      await loginModal.open();

      knownDefect('BUG-007', 'Whitespace-only credentials are sent to the server');
      expect(await loginModal.loginExpectingAlert(WHITESPACE, WHITESPACE)).toBe(
        UI_ALERTS.fillLoginFields,
      );
    },
  );

  test(
    'TC-LOGIN-008 login with wrong password is rejected',
    { tag: ['@smoke', '@regression', '@ui', '@login'] },
    async ({ navbar, loginModal, userFactory }) => {
      const { username } = await userFactory.create('login');
      await loginModal.open();

      expect(await loginModal.loginExpectingAlert(username, WRONG_PASSWORD)).toBe(
        UI_ALERTS.wrongPassword,
      );
      await expect(loginModal.root).toBeVisible();
      await expect(navbar.welcomeText).toBeHidden();
    },
  );

  test(
    'TC-LOGIN-009 login with unknown username is rejected',
    { tag: ['@regression', '@ui', '@login'] },
    async ({ navbar, loginModal }) => {
      await loginModal.open();

      expect(await loginModal.loginExpectingAlert(uniqueUsername('nouser'), WRONG_PASSWORD)).toBe(
        UI_ALERTS.userNotFound,
      );
      await expect(navbar.welcomeText).toBeHidden();
    },
  );

  test(
    'TC-LOGIN-010 username is case-sensitive',
    { tag: ['@regression', '@ui', '@login'] },
    async ({ navbar, loginModal, userFactory }) => {
      const { username, password } = await userFactory.create('login');
      await loginModal.open();

      expect(await loginModal.loginExpectingAlert(username.toUpperCase(), password)).toBe(
        UI_ALERTS.userNotFound,
      );
      await expect(navbar.welcomeText).toBeHidden();
    },
  );

  test(
    'TC-LOGIN-018 password input is masked',
    { tag: ['@regression', '@ui', '@login'] },
    async ({ loginModal }) => {
      await loginModal.open();
      await loginModal.passwordInput.fill('Secret123!');

      await expect(loginModal.passwordInput).toHaveAttribute('type', 'password');
    },
  );

  test(
    'TC-LOGIN-019 pressing Enter in the password field submits the login',
    { tag: ['@regression', '@ui', '@login'] },
    async ({ navbar, loginModal, validCredentials }) => {
      await loginModal.open();
      await loginModal.fill(validCredentials.username, validCredentials.password);

      knownDefect('BUG-009', 'Pressing Enter does not submit the login form');
      await loginModal.passwordInput.press('Enter');

      await expect(navbar.welcomeText).toHaveText(welcomeText(validCredentials.username));
    },
  );

  test(
    'TC-LOGIN-022 closing and reopening the login modal clears the fields',
    { tag: ['@regression', '@ui', '@login'] },
    async ({ loginModal }) => {
      await loginModal.open();
      await loginModal.fill('typed_user', 'typed_pw');
      await loginModal.closeIcon.click();
      await loginModal.waitForClosed();

      await loginModal.open();

      knownDefect('BUG-008', 'Login modal keeps typed username and password after it is closed');
      await expect(loginModal.usernameInput).toHaveValue('');
      await expect(loginModal.passwordInput).toHaveValue('');
    },
  );

  test(
    "TC-LOGIN-021 double-clicking 'Log in' with a wrong password sends one login request",
    { tag: ['@regression', '@ui', '@login'] },
    async ({ page, loginModal, userFactory }) => {
      const { username } = await userFactory.create('login');
      await loginModal.open();
      await loginModal.fill(username, WRONG_PASSWORD);
      const loginRequests = recordLoginRequests(page);
      // BUG-010 raises one alert per request, so collect them all instead of capturing one.
      const dialogs = collectDialogs(page);

      knownDefect('BUG-010', "Double-clicking 'Log in' sends duplicate login requests");
      await loginModal.submitButton.dblclick();

      await expect.poll(() => dialogs.messages[0]).toBe(UI_ALERTS.wrongPassword);
      expect(loginRequests).toHaveLength(1);
    },
  );
});
