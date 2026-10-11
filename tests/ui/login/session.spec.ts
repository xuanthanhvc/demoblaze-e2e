import { welcomeText } from '@data/messages';
import { expect, test } from '@fixtures';
import { HOME_REDIRECT_URL } from '@pages/routes';
import { CartPage } from '@pages/CartPage';
import { SESSION_COOKIE } from '@utils/session';

test.describe('Login session', () => {
  test.use({ session: 'user' });

  test(
    'TC-LOGIN-025 session is kept after page reload',
    { tag: ['@smoke', '@regression', '@ui', '@login'] },
    async ({ page, authenticatedUser, homePage, navbar }) => {
      await homePage.goto();
      await expect(navbar.welcomeText).toHaveText(welcomeText(authenticatedUser.username));

      await page.reload({ waitUntil: 'domcontentloaded' });

      await expect(navbar.welcomeText).toHaveText(welcomeText(authenticatedUser.username));
      await expect(navbar.loginLink).toBeHidden();
    },
  );

  test(
    'TC-LOGIN-026 session is shared with a new tab',
    { tag: ['@regression', '@ui', '@login'] },
    async ({ page, authenticatedUser, homePage, navbar }) => {
      await homePage.goto();
      await expect(navbar.welcomeText).toHaveText(welcomeText(authenticatedUser.username));

      const secondTab = await page.context().newPage();
      const secondCart = new CartPage(secondTab);
      await secondCart.goto();

      await expect(secondCart.navbar.welcomeText).toHaveText(
        welcomeText(authenticatedUser.username),
      );
      await secondTab.close();
    },
  );

  test(
    'TC-LOGIN-027 logout ends the session',
    { tag: ['@smoke', '@regression', '@ui', '@login'] },
    async ({ page, authenticatedUser, homePage, navbar }) => {
      await homePage.goto();
      await expect(navbar.welcomeText).toHaveText(welcomeText(authenticatedUser.username));

      await navbar.logout();

      await expect(page).toHaveURL(HOME_REDIRECT_URL);
      await expect(navbar.welcomeText).toBeHidden();
      await expect(navbar.loginLink).toBeVisible();
      const cookies = await page.context().cookies();
      expect(cookies.map((cookie) => cookie.name)).not.toContain(SESSION_COOKIE);
    },
  );

  test(
    'TC-LOGIN-028 browser Back after logout does not restore the session',
    { tag: ['@regression', '@ui', '@login'] },
    async ({ page, authenticatedUser, cartPage, navbar }) => {
      await cartPage.goto();
      await expect(navbar.welcomeText).toHaveText(welcomeText(authenticatedUser.username));
      await navbar.logout();

      await page.goBack({ waitUntil: 'domcontentloaded' });

      // The "Log out" link (href="#") adds a cart.html# history entry before redirecting.
      await expect(page).toHaveURL(/\/cart\.html#?$/);
      await expect(navbar.loginLink).toBeVisible();
      await expect(navbar.welcomeText).toBeHidden();
    },
  );
});
