import { UI_ALERTS } from '@data/messages';
import { VALID_ORDER_FIELDS, type OrderDetails } from '@data/order';
import { PRODUCT } from '@data/products';
import { expect, knownDefect, test } from '@fixtures';
import { EMPTY_CART } from '@utils/cart';
import { productByTitle } from '@utils/catalog';
import { orderDetails } from '@utils/data';

const WHITESPACE = '   ';

const MISSING_REQUIRED_FIELDS: readonly {
  readonly id: string;
  readonly title: string;
  readonly tag: readonly string[];
  readonly fields: Partial<OrderDetails>;
}[] = [
  {
    id: 'TC-ORDER-010',
    title: 'purchase with all fields empty is rejected',
    tag: ['@smoke', '@regression', '@ui', '@order'],
    fields: {},
  },
  {
    id: 'TC-ORDER-011',
    title: 'purchase with Name only is rejected',
    tag: ['@regression', '@ui', '@order'],
    fields: { name: VALID_ORDER_FIELDS.name },
  },
  {
    id: 'TC-ORDER-012',
    title: 'purchase with Credit card only is rejected',
    tag: ['@regression', '@ui', '@order'],
    fields: { card: VALID_ORDER_FIELDS.card },
  },
];

test.describe('Place order: validation', () => {
  test.use({ session: 'user' });

  for (const { id, title, tag, fields } of MISSING_REQUIRED_FIELDS) {
    test(
      `${id} ${title}`,
      { tag: [...tag] },
      async ({ api, authenticatedUser, seedCart, cartPage, catalog }) => {
        await seedCart([productByTitle(catalog, PRODUCT.galaxyS6)]);
        await cartPage.goto();
        const modal = await cartPage.openPlaceOrder();
        await modal.fill(fields);

        expect(await modal.purchaseExpectingAlert()).toBe(UI_ALERTS.fillOrderFields);

        await expect(modal.root).toBeVisible();
        expect(await api.viewCart(authenticatedUser.token), 'no order placed').toHaveLength(1);
      },
    );
  }

  test(
    'TC-ORDER-014 whitespace-only Name and Credit card are rejected',
    { tag: ['@regression', '@ui', '@order'] },
    async ({ seedCart, cartPage, catalog }) => {
      await seedCart([productByTitle(catalog, PRODUCT.galaxyS6)]);
      await cartPage.goto();
      const modal = await cartPage.openPlaceOrder();
      await modal.fill({ name: WHITESPACE, card: WHITESPACE });

      knownDefect('BUG-005', 'Whitespace-only Name and Credit card pass order validation');
      const outcome = await modal.attemptPurchase();

      expect(outcome).toEqual({ alert: UI_ALERTS.fillOrderFields });
    },
  );

  test(
    'TC-ORDER-018 logged-in user cannot purchase with an empty cart',
    { tag: ['@regression', '@ui', '@order'] },
    async ({ cartPage }) => {
      expect(await cartPage.goto()).toEqual(EMPTY_CART);
      const modal = await cartPage.openPlaceOrder();
      await modal.fill(orderDetails());

      knownDefect('BUG-004', 'Order can be placed with an empty cart (Amount: 0 USD)');
      const outcome = await modal.attemptPurchase();

      expect(outcome.receipt, 'no order confirmation for an empty cart').toBeUndefined();
      expect(outcome.alert, 'the user is told the cart is empty').toBeDefined();
    },
  );
});
