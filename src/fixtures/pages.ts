import { LoginModal } from '@components/LoginModal';
import { Navbar } from '@components/Navbar';
import { OrderConfirmation } from '@components/OrderConfirmation';
import { SignUpModal } from '@components/SignUpModal';
import { CartPage } from '@pages/CartPage';
import { HomePage } from '@pages/HomePage';
import { ProductPage } from '@pages/ProductPage';
import { test as withAuth } from './auth';
import type { PageFixtures } from './types';

/**
 * Page objects and components bound to the test's primary page. The Place
 * Order modal is reached through `cartPage.openPlaceOrder()`.
 */
export const test = withAuth.extend<PageFixtures>({
  navbar: async ({ page }, use) => use(new Navbar(page)),
  loginModal: async ({ page }, use) => use(new LoginModal(page)),
  signUpModal: async ({ page }, use) => use(new SignUpModal(page)),
  orderConfirmation: async ({ page }, use) => use(new OrderConfirmation(page)),
  homePage: async ({ page }, use) => use(new HomePage(page)),
  productPage: async ({ page }, use) => use(new ProductPage(page)),
  cartPage: async ({ page }, use) => use(new CartPage(page)),
});
