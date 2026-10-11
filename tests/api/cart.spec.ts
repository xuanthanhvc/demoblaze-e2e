import { requests } from '@api/requests';
import { API_ERRORS, type CartResponse, type ProductPage } from '@api/types';
import { PRODUCT } from '@data/products';
import { expect, knownDefect, test } from '@fixtures';
import { productByTitle, productsByTitles } from '@utils/catalog';
import { cartItemId } from '@utils/data';

const UNKNOWN_PRODUCT_ID = 999;

test.describe('Cart API', () => {
  test(
    'TC-CART-019 add to cart then view cart',
    { tag: ['@smoke', '@regression', '@api', '@cart'] },
    async ({ api, authenticatedUser, catalog }) => {
      const product = productByTitle(catalog, PRODUCT.galaxyS6);
      const id = cartItemId();

      const added = await api.raw(requests.addToCart(authenticatedUser.token, product.id, id));
      const viewed = await api.raw<CartResponse>(requests.viewCart(authenticatedUser.token));

      expect(added.status).toBe(200);
      expect(added.text).toBe('');
      expect(viewed.status).toBe(200);
      expect(viewed.body.Items).toEqual([
        expect.objectContaining({ id, cookie: authenticatedUser.username, prod_id: product.id }),
      ]);
    },
  );

  test(
    'TC-CART-020 delete a cart item',
    { tag: ['@regression', '@api', '@cart'] },
    async ({ api, authenticatedUser, seedCart, catalog }) => {
      const [deletedId, keptId] = await seedCart(
        productsByTitles(catalog, [PRODUCT.galaxyS6, PRODUCT.nexus6]),
      );

      const result = await api.raw(requests.deleteItem(deletedId!));

      expect(result.status).toBe(200);
      expect(result.body).toBe('Item deleted.');
      const remaining = await api.viewCart(authenticatedUser.token);
      expect(remaining.map((item) => item.id)).toEqual([keptId]);
    },
  );

  test(
    'TC-CART-022 clear the whole cart',
    { tag: ['@regression', '@api', '@cart'] },
    async ({ api, authenticatedUser, seedCart, catalog }) => {
      await seedCart(productsByTitles(catalog, [PRODUCT.galaxyS6, PRODUCT.nexus6]));
      expect(await api.viewCart(authenticatedUser.token)).toHaveLength(2);

      const cleared = await api.raw(requests.deleteCart(authenticatedUser.username));

      expect(cleared.status).toBe(200);
      expect(cleared.body).toBe('Item deleted.');
      expect(await api.viewCart(authenticatedUser.token)).toEqual([]);

      const repeated = await api.raw(requests.deleteCart(authenticatedUser.username));
      expect(repeated.status, 'clearing an empty cart is harmless').toBe(200);
      expect(await api.viewCart(authenticatedUser.token)).toEqual([]);
    },
  );

  test(
    'TC-CART-023 adding a non-existent product is rejected',
    { tag: ['@regression', '@api', '@cart'] },
    async ({ api, authenticatedUser }) => {
      const lookup = await api.raw(requests.view(UNKNOWN_PRODUCT_ID));
      expect(lookup.body, 'precondition: product does not exist').toEqual({
        errorMessage: API_ERRORS.notFound,
      });

      knownDefect('BUG-012', 'Add-to-cart API accepts a product id that does not exist');
      await api.raw(requests.addToCart(authenticatedUser.token, UNKNOWN_PRODUCT_ID));

      const items = await api.viewCart(authenticatedUser.token);
      expect(items.map((item) => item.prod_id)).not.toContain(UNKNOWN_PRODUCT_ID);
    },
  );

  test(
    'TC-CART-025 catalog lists products with title and price',
    { tag: ['@smoke', '@regression', '@api', '@cart'] },
    async ({ api }) => {
      const result = await api.raw<ProductPage>(requests.entries());

      expect(result.status).toBe(200);
      expect(result.body.Items.length).toBeGreaterThan(0);
      for (const item of result.body.Items) {
        expect(item).toEqual(
          expect.objectContaining({
            id: expect.any(Number),
            title: expect.any(String),
            price: expect.any(Number),
            cat: expect.any(String),
          }),
        );
      }
    },
  );
});
