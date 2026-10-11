import type { APIRequest, APIRequestContext } from '@playwright/test';
import { env } from '@config/env';

/** Creates a request context pointed at the configured API host. Caller disposes it. */
export function newApiRequestContext(request: APIRequest): Promise<APIRequestContext> {
  return request.newContext({ baseURL: env.apiUrl, timeout: env.timeouts.api });
}
