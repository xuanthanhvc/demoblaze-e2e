import type { TestInfo } from '@playwright/test';
import { env } from '@config/env';
import { productIds } from '@utils/catalog';
import { uniqueCredentials } from '@utils/data';
import { guestCartKey, injectGuestSession, injectSession } from '@utils/session';
import { test as withApi } from './api';
import type { AuthenticatedUser, AuthFixtures, FrameworkOptions } from './types';

/** Runs a teardown step; a failure becomes a report annotation instead of failing the test. */
async function cleanup(
  testInfo: TestInfo,
  what: string,
  step: () => Promise<unknown>,
): Promise<void> {
  try {
    await step();
  } catch (error) {
    testInfo.annotations.push({
      type: 'cleanup-warning',
      description: `${what} failed: ${String(error)}`,
    });
  }
}

/**
 * Users, sessions and cart seeding, independent of which page objects a test
 * uses. Every browser page starts isolated: as a guest with its own cart, or
 * logged in as a fresh user (`test.use({ session: 'user' })`).
 */
export const test = withApi.extend<AuthFixtures & FrameworkOptions>({
  session: ['guest', { option: true }],

  userFactory: async ({ api }, use) => {
    await use({
      async create(tag) {
        const credentials = uniqueCredentials(tag);
        await api.signup(credentials.username, credentials.password);
        return credentials;
      },
    });
  },

  validCredentials: async ({ userFactory }, use) => {
    await use(env.credentials ?? (await userFactory.create('login')));
  },

  userSession: async ({ api, userFactory }, use, testInfo) => {
    let user: Promise<AuthenticatedUser> | undefined;
    await use({
      get: () =>
        (user ??= (async () => {
          const credentials = await userFactory.create('auth');
          const token = await api.login(credentials.username, credentials.password);
          return { ...credentials, token };
        })()),
    });
    // A failed signup/login has already failed the test; there is nothing to clean.
    const created = await user?.catch(() => undefined);
    if (created === undefined) return;
    const { username } = created;
    await cleanup(testInfo, `Cart cleanup for ${username}`, () => api.deleteCart(username));
  },

  authenticatedUser: async ({ userSession }, use) => {
    await use(await userSession.get());
  },

  seedCart: async ({ api, authenticatedUser }, use) => {
    await use(async (items) => {
      const ids: string[] = [];
      for (const productId of productIds(items)) {
        ids.push(await api.addToCart(authenticatedUser.token, productId));
      }
      return ids;
    });
  },

  page: async ({ page, context, session, userSession, api }, use, testInfo) => {
    // Without its own guest cookie, a guest that lands directly on a product page
    // shares one backend cart with every other such guest.
    const guestCartId = await injectGuestSession(context, env.baseUrl);
    if (session === 'user') {
      await injectSession(context, env.baseUrl, (await userSession.get()).token);
    }
    await use(page);
    await cleanup(testInfo, `Guest cart cleanup for ${guestCartId}`, () =>
      api.deleteCart(guestCartKey(guestCartId)),
    );
  },
});
