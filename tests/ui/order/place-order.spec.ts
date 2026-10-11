import { ORDER_CONFIRMATION_TITLE, UI_ALERTS, welcomeText } from '@data/messages';
import { VALID_ORDER_FIELDS } from '@data/order';
import { PRODUCT } from '@data/products';
import { expect, knownDefect, test } from '@fixtures';
import { HOME_REDIRECT_URL } from '@pages/routes';
import { cartRow, EMPTY_CART, expectedCart, normalizeCart } from '@utils/cart';
import { productByTitle, productsByTitles } from '@utils/catalog';
import { orderDetails } from '@utils/data';
import { sumPrices } from '@utils/money';

const VALID_ORDER = orderDetails(VALID_ORDER_FIELDS);

test.describe('Place order', () => {
  test.describe('logged-in user', () => {
    test.use({ session: 'user' });

    test(
      'TC-ORDER-002 order form total equals the cart total',
      { tag: ['@regression', '@ui', '@order'] },
      async ({ seedCart, cartPage, catalog }) => {
        const products = productsByTitles(catalog, [PRODUCT.nokiaLumia1520, PRODUCT.galaxyS6]);
        await seedCart(products);
        const cart = await cartPage.goto();

        const modal = await cartPage.openPlaceOrder();

        await expect(modal.totalLabel).toHaveText(`Total: ${cart.total}`);
        expect(cart.total).toBe(sumPrices(products.map((p) => p.price)));
      },
    );

    test(
      'TC-ORDER-003 confirmation amount equals the cart total',
      { tag: ['@smoke', '@regression', '@ui', '@order'] },
      async ({ seedCart, cartPage, catalog }) => {
        const products = productsByTitles(catalog, [PRODUCT.nexus6, PRODUCT.nokiaLumia1520]);
        await seedCart(products);
        const cart = await cartPage.goto();

        const receipt = await cartPage.purchaseOrder(VALID_ORDER);

        expect(receipt.amount).toBe(cart.total);
        expect(receipt.currency).toBe('USD');
        expect(receipt.amount).toBe(sumPrices(products.map((p) => p.price)));
      },
    );

    test(
      'TC-ORDER-004 confirmation shows the entered name and card number',
      { tag: ['@regression', '@ui', '@order'] },
      async ({ seedCart, cartPage, catalog }) => {
        await seedCart([productByTitle(catalog, PRODUCT.galaxyS6)]);
        await cartPage.goto();

        const receipt = await cartPage.purchaseOrder(VALID_ORDER);

        expect(receipt.name).toBe(VALID_ORDER.name);
        expect(receipt.cardNumber).toBe(VALID_ORDER.card);
      },
    );

    test(
      "TC-ORDER-005 confirmation date equals today's date",
      { tag: ['@regression', '@ui', '@order'] },
      async ({ page, seedCart, cartPage, catalog }) => {
        const today = { day: 8, month: 10, year: 2026 };
        // `Date` months are zero-based. Midday keeps the calendar date stable in any time zone.
        await page.clock.setFixedTime(new Date(today.year, today.month - 1, today.day, 12));
        await seedCart([productByTitle(catalog, PRODUCT.galaxyS6)]);
        await cartPage.goto();

        knownDefect('BUG-001', 'Purchase confirmation date shows the previous month');
        const receipt = await cartPage.purchaseOrder(VALID_ORDER);

        expect(receipt.date).toBe(`${today.day}/${today.month}/${today.year}`);
      },
    );

    test(
      'TC-ORDER-006 confirmation contains a numeric order id',
      { tag: ['@regression', '@ui', '@order'] },
      async ({ seedCart, cartPage, catalog }) => {
        await seedCart([productByTitle(catalog, PRODUCT.galaxyS6)]);
        await cartPage.goto();

        const receipt = await cartPage.purchaseOrder(VALID_ORDER);

        expect(receipt.id).toMatch(/^\d+$/);
      },
    );

    test(
      'TC-ORDER-007 cart is emptied after a successful purchase',
      { tag: ['@smoke', '@regression', '@ui', '@order'] },
      async ({ api, authenticatedUser, seedCart, cartPage, catalog }) => {
        await seedCart(productsByTitles(catalog, [PRODUCT.galaxyS6, PRODUCT.sonyXperiaZ5]));
        await cartPage.goto();
        await cartPage.purchaseOrder(VALID_ORDER);

        expect(await cartPage.goto()).toEqual(EMPTY_CART);
        expect(await api.viewCart(authenticatedUser.token)).toEqual([]);
      },
    );

    test(
      'TC-ORDER-008 OK on the confirmation returns to the home page',
      { tag: ['@regression', '@ui', '@order'] },
      async ({ page, seedCart, cartPage, orderConfirmation, catalog }) => {
        await seedCart([productByTitle(catalog, PRODUCT.galaxyS6)]);
        await cartPage.goto();
        await cartPage.purchaseOrder(VALID_ORDER);

        await orderConfirmation.confirm();

        await expect(page).toHaveURL(HOME_REDIRECT_URL);
        await expect(orderConfirmation.root).toBeHidden();
      },
    );

    test(
      'TC-ORDER-021 closing the order form keeps the cart',
      { tag: ['@regression', '@ui', '@order'] },
      async ({ api, authenticatedUser, seedCart, cartPage, orderConfirmation, catalog }) => {
        const product = productByTitle(catalog, PRODUCT.galaxyS6);
        await seedCart([product]);
        const before = await cartPage.goto();
        const modal = await cartPage.openPlaceOrder();
        await modal.fill({ name: VALID_ORDER.name, card: VALID_ORDER.card });

        await modal.close();

        await expect(orderConfirmation.root).toBeHidden();
        expect(await cartPage.reload()).toEqual(before);
        expect(before.rows).toEqual([cartRow(product)]);
        expect(await api.viewCart(authenticatedUser.token)).toHaveLength(1);
      },
    );
  });

  test.describe('guest', () => {
    test(
      'TC-ORDER-001 user logs in, adds products to the cart and places an order',
      { tag: ['@smoke', '@regression', '@ui', '@order'] },
      async ({
        page,
        homePage,
        navbar,
        loginModal,
        productPage,
        cartPage,
        orderConfirmation,
        authenticatedUser,
        catalog,
      }) => {
        // Starts as a guest and logs in through the UI. A fresh account, not validCredentials:
        // this test asserts exact cart contents, so a shared DEMOBLAZE_USERNAME account would
        // collide across parallel browser jobs.
        const { username, password } = authenticatedUser;
        const products = productsByTitles(catalog, [PRODUCT.nexus6, PRODUCT.nokiaLumia1520]);

        await test.step('log in with valid credentials', async () => {
          await homePage.goto();
          await loginModal.open();
          await loginModal.login(username, password);
          await expect(navbar.welcomeText).toHaveText(welcomeText(username));
        });

        await test.step('add products to the cart', async () => {
          const alerts = await productPage.addProducts(products);
          expect(alerts).toEqual(products.map(() => UI_ALERTS.productAdded));
        });

        const cart = await test.step('review the cart', async () => {
          const snapshot = await cartPage.openFromNavbar();
          expect(normalizeCart(snapshot)).toEqual(expectedCart(products));
          return snapshot;
        });

        const receipt = await test.step('place the order', async () => {
          const modal = await cartPage.openPlaceOrder();
          await expect(modal.totalLabel).toHaveText(`Total: ${cart.total}`);
          await modal.fill(VALID_ORDER);
          return modal.purchase();
        });

        await test.step('confirmation shows the order details', async () => {
          await expect(orderConfirmation.title).toHaveText(ORDER_CONFIRMATION_TITLE);
          expect(receipt).toMatchObject({
            amount: cart.total,
            currency: 'USD',
            name: VALID_ORDER.name,
            cardNumber: VALID_ORDER.card,
          });
          expect(receipt.id).toMatch(/^\d+$/);
        });

        await test.step('OK returns to the home page and the cart is empty', async () => {
          await orderConfirmation.confirm();
          await expect(page).toHaveURL(HOME_REDIRECT_URL);
          expect(await cartPage.openFromNavbar()).toEqual(EMPTY_CART);
        });
      },
    );

    test(
      'TC-ORDER-020 guest can place an order with items in the cart',
      { tag: ['@regression', '@ui', '@order'] },
      async ({ productPage, cartPage, catalog }) => {
        const products = productsByTitles(catalog, [PRODUCT.galaxyS6, PRODUCT.sonyXperiaZ5]);
        const alerts = await productPage.addProducts(products);
        expect(alerts).toEqual(products.map(() => UI_ALERTS.productAddedGuest));

        const cart = await cartPage.openFromNavbar();
        expect(normalizeCart(cart)).toEqual(expectedCart(products));

        const receipt = await cartPage.purchaseOrder(VALID_ORDER);

        expect(receipt.amount).toBe(sumPrices(products.map((p) => p.price)));
        expect(await cartPage.goto()).toEqual(EMPTY_CART);
      },
    );
  });
});
