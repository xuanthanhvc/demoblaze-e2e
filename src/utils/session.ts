import { randomUUID } from 'node:crypto';
import type { BrowserContext } from '@playwright/test';

/** Cookie in which the UI stores the API session token after login. */
export const SESSION_COOKIE = 'tokenp_';

/** Cookie holding the anonymous cart id the UI generates for guests. */
export const GUEST_COOKIE = 'user';

/**
 * Makes the browser context authenticated without going through the login UI
 * by setting the same cookie the site writes after a successful login.
 * Must be called before the first navigation that should be authenticated.
 */
export async function injectSession(
  context: BrowserContext,
  baseUrl: string,
  token: string,
): Promise<void> {
  await context.addCookies([{ name: SESSION_COOKIE, value: token, url: `${baseUrl}/` }]);
}

/**
 * Gives the browser context its own anonymous cart by setting the guest cart
 * cookie the site would otherwise assign only when the home page runs.
 * Without it, guests that land directly on a product page all share the same
 * (empty-key) cart. Must be called before the first navigation.
 *
 * @returns The guest cart id.
 */
export async function injectGuestSession(
  context: BrowserContext,
  baseUrl: string,
  cartId: string = randomUUID(),
): Promise<string> {
  await context.addCookies([{ name: GUEST_COOKIE, value: cartId, url: `${baseUrl}/` }]);
  return cartId;
}

/**
 * Cart key the backend uses for a guest: the page sends its whole
 * `document.cookie`, which for a fresh guest is exactly `user=<id>`.
 */
export function guestCartKey(cartId: string): string {
  return `${GUEST_COOKIE}=${cartId}`;
}
