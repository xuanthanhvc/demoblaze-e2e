import { env } from '@config/env';
import { PRODUCT } from '@data/products';
import { expect, test } from '@fixtures';
import { productsByTitles } from '@utils/catalog';
import { readNavigationMetrics } from '@utils/perf';

test.describe('Cart page performance budgets', () => {
  test.use({ session: 'user' });

  test(
    'TC-CART-029 cart page navigation timing is within budget',
    { tag: ['@perf', '@ui', '@cart'] },
    async ({ page, seedCart, cartPage, catalog }, testInfo) => {
      const products = productsByTitles(catalog, [PRODUCT.galaxyS6, PRODUCT.nexus6]);
      await seedCart(products);

      const cart = await cartPage.goto();
      expect(cart.rows).toHaveLength(products.length);

      const metrics = await readNavigationMetrics(page);
      await testInfo.attach('navigation-timing', {
        body: JSON.stringify({ metrics, budgets: env.perf }, null, 2),
        contentType: 'application/json',
      });

      expect
        .soft(metrics.domContentLoaded, 'domContentLoaded (ms)')
        .toBeLessThan(env.perf.domContentLoadedMs);
      expect.soft(metrics.load, 'load (ms)').toBeLessThan(env.perf.loadMs);
    },
  );
});
