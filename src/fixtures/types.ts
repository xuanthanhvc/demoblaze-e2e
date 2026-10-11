import type { DemoBlazeApiClient } from '@api/DemoBlazeApiClient';
import type { Product } from '@api/types';
import type { LoginModal } from '@components/LoginModal';
import type { Navbar } from '@components/Navbar';
import type { OrderConfirmation } from '@components/OrderConfirmation';
import type { SignUpModal } from '@components/SignUpModal';
import type { Credentials } from '@data/user';
import type { CartPage } from '@pages/CartPage';
import type { HomePage } from '@pages/HomePage';
import type { ProductPage } from '@pages/ProductPage';
import type { ProductRef } from '@utils/catalog';

/** Creates fresh accounts through the API. */
export interface UserFactory {
  /** Signs up a new unique `qa_` user and returns its plain-text credentials. */
  create(tag?: string): Promise<Credentials>;
}

/** A signed-up user with an API session token. */
export interface AuthenticatedUser extends Credentials {
  readonly token: string;
}

/**
 * Browser session a test starts with, set per file or describe with
 * `test.use({ session: 'user' })`.
 *
 * - `guest` (default): logged out, with an anonymous cart owned by this test only.
 * - `user`: logged in as {@link AuthFixtures.authenticatedUser} by cookie, without the login UI.
 */
export type BrowserSession = 'guest' | 'user';

/** Fixture options that can be changed per file/describe with `test.use()`. */
export interface FrameworkOptions {
  session: BrowserSession;
}

/** Adds products to the authenticated user's cart via API; returns cart line ids. */
export type SeedCart = (items: readonly ProductRef[]) => Promise<string[]>;

/** Lazily creates the test's {@link AuthenticatedUser}, at most once per test. */
export interface UserSession {
  get(): Promise<AuthenticatedUser>;
}

export interface ApiFixtures {
  api: DemoBlazeApiClient;
}

export interface WorkerFixtures {
  /** Full product catalog fetched once per worker. */
  catalog: Product[];
}

export interface AuthFixtures {
  userFactory: UserFactory;
  /** Credentials for "valid login": DEMOBLAZE_USERNAME/PASSWORD if set, else a fresh user. */
  validCredentials: Credentials;
  /** Internal: shares one user between `authenticatedUser` and a `session: 'user'` page. */
  userSession: UserSession;
  /**
   * Fresh user, logged in via API; cart emptied in teardown. With
   * `session: 'user'` the browser is logged in as this user.
   */
  authenticatedUser: AuthenticatedUser;
  seedCart: SeedCart;
}

export interface PageFixtures {
  navbar: Navbar;
  loginModal: LoginModal;
  signUpModal: SignUpModal;
  orderConfirmation: OrderConfirmation;
  homePage: HomePage;
  productPage: ProductPage;
  cartPage: CartPage;
}
