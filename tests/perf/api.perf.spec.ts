import { requests } from '@api/requests';
import type { CartResponse } from '@api/types';
import { env } from '@config/env';
import { PRODUCT } from '@data/products';
import { expect, test } from '@fixtures';
import { productsByTitles } from '@utils/catalog';

test.describe('API response time budgets', () => {
  test(
    'TC-LOGIN-039 login response time is within budget',
    { tag: ['@api', '@perf', '@login'] },
    async ({ api, userFactory }, testInfo) => {
      const { username, password } = await userFactory.create('perf');

      const result = await api.raw<string>(requests.login(username, password));
      testInfo.annotations.push({
        type: 'api-response-ms',
        description: result.durationMs.toFixed(0),
      });

      expect(result.body).toMatch(/^Auth_token: /);
      expect(result.durationMs, 'POST /login (ms)').toBeLessThan(env.perf.apiResponseMs);
    },
  );

  test(
    'TC-CART-028 cart response time is within budget',
    { tag: ['@api', '@perf', '@cart'] },
    async ({ api, authenticatedUser, seedCart, catalog }, testInfo) => {
      await seedCart(productsByTitles(catalog, [PRODUCT.galaxyS6, PRODUCT.nexus6]));

      const result = await api.raw<CartResponse>(requests.viewCart(authenticatedUser.token));
      testInfo.annotations.push({
        type: 'api-response-ms',
        description: result.durationMs.toFixed(0),
      });

      expect(result.body.Items).toHaveLength(2);
      expect(result.durationMs, 'POST /viewcart (ms)').toBeLessThan(env.perf.apiResponseMs);
    },
  );
});
