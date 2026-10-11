import { UI_ALERTS } from '@data/messages';
import { PRODUCT } from '@data/products';
import { expect, test } from '@fixtures';
import { cartRow, EMPTY_CART, expectedCart, normalizeCart, sortRows } from '@utils/cart';
import { displayTitle, productByTitle, productsByTitles } from '@utils/catalog';

test.describe('Cart: contents and totals', () => {
  test.describe('logged-in user', () => {
    test.use({ session: 'user' });

    test(
      'TC-CART-008 cart total equals the sum of item prices',
      { tag: ['@smoke', '@regression', '@ui', '@cart'] },
      async ({ seedCart, cartPage, catalog }) => {
        const products = productsByTitles(catalog, [
          PRODUCT.sonyVaioI5,
          PRODUCT.galaxyS6,
          PRODUCT.galaxyS6,
          PRODUCT.sonyVaioI7,
        ]);
        await seedCart(products);

        expect(normalizeCart(await cartPage.goto())).toEqual(expectedCart(products));
      },
    );

    test(
      'TC-CART-010 delete one item updates the list and total',
      { tag: ['@smoke', '@regression', '@ui', '@cart'] },
      async ({ seedCart, cartPage, catalog }) => {
        const deleted = productByTitle(catalog, PRODUCT.galaxyS6);
        const kept = productsByTitles(catalog, [PRODUCT.sonyVaioI5, PRODUCT.nexus6]);
        await seedCart([deleted, ...kept]);
        const before = await cartPage.goto();
        expect(before.rows).toHaveLength(3);

        const after = await cartPage.deleteItem(displayTitle(deleted));

        expect(normalizeCart(after)).toEqual(expectedCart(kept));
        expect(after.total).toBe(before.total - deleted.price);
        const reloaded = await cartPage.reload();
        expect(sortRows(reloaded.rows)).toEqual(sortRows(after.rows));
        expect(reloaded.total).toBe(after.total);
      },
    );

    test(
      'TC-CART-011 delete the last item leaves an empty cart',
      { tag: ['@regression', '@ui', '@cart'] },
      async ({ seedCart, cartPage, catalog }) => {
        const product = productByTitle(catalog, PRODUCT.galaxyS7);
        await seedCart([product]);
        const before = await cartPage.goto();
        expect(before.rows).toEqual([cartRow(product)]);

        const after = await cartPage.deleteItem(displayTitle(product));

        expect(after).toEqual(EMPTY_CART);
        await expect(cartPage.total).toBeEmpty();
      },
    );

    test(
      'TC-CART-013 cart persists after logout and login again',
      { tag: ['@regression', '@ui', '@cart'] },
      async ({ authenticatedUser, seedCart, cartPage, navbar, loginModal, catalog }) => {
        const products = productsByTitles(catalog, [
          PRODUCT.nexus6,
          PRODUCT.nokiaLumia1520,
          PRODUCT.galaxyS6,
        ]);
        await seedCart(products);
        const before = await cartPage.goto();
        expect(normalizeCart(before)).toEqual(expectedCart(products));

        await navbar.logout();
        await loginModal.open();
        await loginModal.login(authenticatedUser.username, authenticatedUser.password);
        const after = await cartPage.openFromNavbar();

        expect(normalizeCart(after)).toEqual(normalizeCart(before));
      },
    );
  });

  test.describe('guest', () => {
    test(
      'TC-CART-014 guest cart and user cart are kept separate',
      { tag: ['@regression', '@ui', '@cart'] },
      async ({ authenticatedUser, productPage, cartPage, navbar, loginModal, catalog }) => {
        const product = productByTitle(catalog, PRODUCT.galaxyS6);
        await productPage.goto(product.id);
        expect(await productPage.addToCart()).toBe(UI_ALERTS.productAddedGuest);
        const guestCart = await cartPage.openFromNavbar();
        expect(guestCart.rows).toEqual([cartRow(product)]);

        await loginModal.open();
        await loginModal.login(authenticatedUser.username, authenticatedUser.password);
        const userCart = await cartPage.reload();
        expect(userCart, 'guest items are not merged into the account cart').toEqual(EMPTY_CART);

        await navbar.logout();
        const guestCartAgain = await cartPage.openFromNavbar();
        expect(guestCartAgain.rows, 'guest cart is shown again after logout').toEqual([
          cartRow(product),
        ]);
      },
    );

    test(
      'TC-CART-027 home page product cards match catalog data',
      { tag: ['@regression', '@ui', '@cart'] },
      async ({ api, homePage }) => {
        const firstPage = await api.getEntries();

        await homePage.goto();

        await expect(homePage.productCards).toHaveCount(firstPage.Items.length);
        expect(await homePage.getProductCards()).toEqual(firstPage.Items.map(cartRow));
      },
    );
  });
});
