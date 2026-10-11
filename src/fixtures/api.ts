import type { APIRequest } from '@playwright/test';
import { DemoBlazeApiClient } from '@api/DemoBlazeApiClient';
import { newApiRequestContext } from '@api/requestContext';
import { test as withDialogs } from './dialogGuard';
import type { ApiFixtures, WorkerFixtures } from './types';

/** Opens an API client on its own request context; the caller disposes it. */
async function openApiClient(
  request: APIRequest,
  onRetry?: (message: string) => void,
): Promise<{ client: DemoBlazeApiClient; dispose: () => Promise<void> }> {
  const context = await newApiRequestContext(request);
  return {
    client: new DemoBlazeApiClient(context, onRetry ? { onRetry } : {}),
    dispose: () => context.dispose(),
  };
}

/** API client (per test) and catalog (per worker). */
export const test = withDialogs.extend<ApiFixtures, WorkerFixtures>({
  api: async ({ playwright }, use, testInfo) => {
    const { client, dispose } = await openApiClient(playwright.request, (message) =>
      testInfo.annotations.push({ type: 'api-retry', description: message }),
    );
    await use(client);
    await dispose();
  },

  catalog: [
    async ({ playwright }, use) => {
      const { client, dispose } = await openApiClient(playwright.request);
      let products;
      try {
        products = await client.getAllProducts();
      } finally {
        await dispose();
      }
      await use(products);
    },
    { scope: 'worker' },
  ],
});
