import { UI_ALERTS } from '@data/messages';
import { PRODUCT } from '@data/products';
import { expect, test } from '@fixtures';
import { cartRow, expectedCart, normalizeCart, sortRows } from '@utils/cart';
import { displayTitle, productByTitle, productsByTitles } from '@utils/catalog';
import { collectDialogs } from '@utils/dialog';

test.describe('Cart: add to cart', () => {
  test.describe('logged-in user', () => {
    test.use({ session: 'user' });

    test(
      'TC-CART-001 logged-in user adds a product to the cart',
      { tag: ['@smoke', '@regression', '@ui', '@cart'] },
      async ({ productPage, cartPage, catalog }) => {
        const product = productByTitle(catalog, PRODUCT.galaxyS6);
        await productPage.goto(product.id);

        expect(await productPage.addToCart()).toBe(UI_ALERTS.productAdded);

        const cart = await cartPage.openFromNavbar();
        expect(cart.rows).toEqual([cartRow(product)]);
        expect(cart.total).toBe(product.price);
      },
    );

    test(
      'TC-CART-004 cart price matches the product page price',
      { tag: ['@smoke', '@regression', '@ui', '@cart'] },
      async ({ productPage, cartPage, catalog }) => {
        const products = productsByTitles(catalog, [PRODUCT.galaxyS6, PRODUCT.sonyVaioI5]);
        const shownOnProductPage = [];
        for (const product of products) {
          await productPage.goto(product.id);
          shownOnProductPage.push({
            title: await productPage.getName(),
            price: await productPage.getPrice(),
          });
          expect(await productPage.addToCart()).toBe(UI_ALERTS.productAdded);
        }

        const cart = await cartPage.openFromNavbar();

        expect(sortRows(cart.rows)).toEqual(sortRows(shownOnProductPage));
      },
    );

    test(
      'TC-CART-006 add several different products',
      { tag: ['@regression', '@ui', '@cart'] },
      async ({ productPage, cartPage, catalog }) => {
        const products = productsByTitles(catalog, [
          PRODUCT.galaxyS6,
          PRODUCT.sonyVaioI5,
          PRODUCT.sonyVaioI7,
        ]);
        const alerts = await productPage.addProducts(products);
        expect(alerts).toEqual(products.map(() => UI_ALERTS.productAdded));

        expect(normalizeCart(await cartPage.openFromNavbar())).toEqual(expectedCart(products));
      },
    );

    test(
      'TC-CART-007 adding the same product twice creates two rows',
      { tag: ['@regression', '@ui', '@cart'] },
      async ({ productPage, cartPage, catalog }) => {
        const product = productByTitle(catalog, PRODUCT.galaxyS6);
        await productPage.goto(product.id);

        expect(await productPage.addToCart()).toBe(UI_ALERTS.productAdded);
        expect(await productPage.addToCart()).toBe(UI_ALERTS.productAdded);

        const cart = await cartPage.openFromNavbar();
        expect(cart.rows).toEqual([cartRow(product), cartRow(product)]);
        expect(cart.total).toBe(product.price * 2);
      },
    );

    test(
      "TC-CART-009 repeated rapid 'Add to cart' clicks are each added",
      { tag: ['@regression', '@ui', '@cart'] },
      async ({ page, productPage, cartPage, catalog }) => {
        const product = productByTitle(catalog, PRODUCT.nexus6);
        await productPage.goto(product.id);
        const dialogs = collectDialogs(page);

        await productPage.addToCartButton.click({ clickCount: 3 });

        await expect
          .poll(() => dialogs.messages)
          .toEqual([UI_ALERTS.productAdded, UI_ALERTS.productAdded, UI_ALERTS.productAdded]);
        const cart = await cartPage.openFromNavbar();
        expect(cart.rows).toEqual([cartRow(product), cartRow(product), cartRow(product)]);
        expect(cart.total).toBe(product.price * 3);
      },
    );
  });

  test.describe('guest', () => {
    test(
      'TC-CART-002 guest user adds a product to the cart',
      { tag: ['@regression', '@ui', '@cart'] },
      async ({ productPage, cartPage, catalog }) => {
        const product = productByTitle(catalog, PRODUCT.galaxyS6);
        await productPage.goto(product.id);

        expect(await productPage.addToCart()).toBe(UI_ALERTS.productAddedGuest);

        const cart = await cartPage.openFromNavbar();
        expect(cart.rows).toEqual([cartRow(product)]);
        expect(cart.total).toBe(product.price);
      },
    );

    test(
      'TC-CART-005 product page title and price match the catalog API',
      { tag: ['@regression', '@ui', '@cart'] },
      async ({ api, productPage, catalog }) => {
        const { id } = productByTitle(catalog, PRODUCT.galaxyS6);
        const fromApi = await api.getProduct(id);

        await productPage.goto(id);

        expect(await productPage.getName()).toBe(displayTitle(fromApi));
        expect(await productPage.getPrice()).toBe(fromApi.price);
        await expect(productPage.price).toContainText('*includes tax');
      },
    );
  });
});
