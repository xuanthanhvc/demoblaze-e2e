import type { APIRequestContext, Response } from '@playwright/test';
import { env } from '@config/env';
import { cartItemId } from '@utils/data';
import { isTransientStatus, withRetry, type RetryOutcome } from '@utils/retry';
import { requests, type ApiRequest } from './requests';
import {
  API_ERRORS,
  type ApiErrorBody,
  type ApiResult,
  type CartItem,
  type CartResponse,
  type Product,
  type ProductCategory,
  type ProductPage,
  type TokenInfo,
} from './types';

/** Thrown when the backend answers with an error envelope or unexpected payload. */
export class DemoBlazeApiError extends Error {
  constructor(
    readonly endpoint: string,
    readonly status: number,
    readonly errorMessage: string,
    readonly responseText: string,
  ) {
    super(`DemoBlaze API ${endpoint} failed (HTTP ${status}): ${errorMessage}`);
    this.name = 'DemoBlazeApiError';
  }
}

/** Retry policy for transient failures of business calls. */
export interface ApiRetryPolicy {
  /** Extra attempts after the first (0 disables). */
  readonly retries: number;
  /** First backoff delay; doubles per retry. */
  readonly baseDelayMs: number;
}

/** Options for {@link DemoBlazeApiClient}. */
export interface DemoBlazeApiClientOptions {
  readonly retry?: ApiRetryPolicy;
  /** Receives a description of every retry (e.g. to annotate the running test). */
  readonly onRetry?: (message: string) => void;
}

/** Prefix of a successful `/login` response body. */
export const AUTH_TOKEN_PREFIX = 'Auth_token: ';

const MISSING_ITEMS = 'Missing Items in response';

function isErrorBody(body: unknown): body is ApiErrorBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as Partial<ApiErrorBody>).errorMessage === 'string'
  );
}

function hasItems(body: unknown): body is { Items: unknown[] } {
  return (
    typeof body === 'object' && body !== null && Array.isArray((body as { Items?: unknown }).Items)
  );
}

function parseBody(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed === '') return '';
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return trimmed;
  }
}

/** Network errors, timeouts, HTTP 429 and 5xx are transient; business errors are not. */
function isTransient(outcome: RetryOutcome): boolean {
  if ('error' in outcome) return true;
  return isTransientStatus((outcome.value as ApiResult).status);
}

function describeOutcome(outcome: RetryOutcome): string {
  if ('error' in outcome) {
    return outcome.error instanceof Error
      ? outcome.error.message.split('\n')[0]!
      : String(outcome.error);
  }
  return `HTTP ${(outcome.value as ApiResult).status}`;
}

/**
 * Reads the `Items` list from a backend response the browser received (e.g.
 * the cart page's own `/viewcart` call), with the same shape check the client
 * applies to its own calls.
 */
export async function responseItems<T>(response: Response): Promise<T[]> {
  const text = await response.text();
  const body = parseBody(text);
  if (!hasItems(body)) {
    const message = isErrorBody(body) ? body.errorMessage : MISSING_ITEMS;
    throw new DemoBlazeApiError(new URL(response.url()).pathname, response.status(), message, text);
  }
  return body.Items as T[];
}

/**
 * Typed client for the DemoBlaze REST backend.
 *
 * Business methods throw {@link DemoBlazeApiError} when the backend returns an
 * `errorMessage` (it does so with HTTP 200) and retry transient failures
 * (network error, HTTP 429/5xx) with a short bounded backoff.
 *
 * For contract, negative or timing tests use {@link DemoBlazeApiClient.raw}
 * with a builder from {@link requests}: it sends exactly one request and never
 * throws on error envelopes.
 */
export class DemoBlazeApiClient {
  private readonly retry: ApiRetryPolicy;
  private readonly onRetry: ((message: string) => void) | undefined;

  /**
   * @param context A request context whose `baseURL` points at the API host.
   * @param options Retry policy (defaults to `API_RETRIES`) and retry listener.
   */
  constructor(
    private readonly context: APIRequestContext,
    options: DemoBlazeApiClientOptions = {},
  ) {
    this.retry = options.retry ?? env.apiRetry;
    this.onRetry = options.onRetry;
  }

  /**
   * Sends one request and returns status, parsed body and latency. Never
   * retries and never throws on error envelopes.
   *
   * @example
   * const result = await api.raw(requests.login(username, 'wrong'));
   * expect(result.body).toEqual({ errorMessage: API_ERRORS.wrongPassword });
   */
  async raw<T = unknown>(request: ApiRequest): Promise<ApiResult<T>> {
    const started = performance.now();
    const response =
      request.data === undefined
        ? await this.context.get(request.endpoint)
        : await this.context.post(request.endpoint, { data: request.data });
    const text = await response.text();
    const durationMs = performance.now() - started;
    return { status: response.status(), text, body: parseBody(text) as T, durationMs };
  }

  /**
   * Registers a new account. If a transient failure forced a retry and the
   * retry reports "already exist", the first attempt reached the server; this
   * is confirmed by logging in instead of failing.
   */
  async signup(username: string, password: string): Promise<void> {
    const request = requests.signup(username, password);
    const { result, attempts } = await this.send(request);
    if (
      attempts > 1 &&
      isErrorBody(result.body) &&
      result.body.errorMessage === API_ERRORS.userExists
    ) {
      await this.login(username, password);
      return;
    }
    this.ensureOk(request, result);
  }

  /** Logs in and returns the session token (without the `Auth_token: ` prefix). */
  async login(username: string, password: string): Promise<string> {
    const request = requests.login(username, password);
    const result = await this.call(request);
    if (typeof result.body !== 'string' || !result.body.startsWith(AUTH_TOKEN_PREFIX)) {
      throw new DemoBlazeApiError(
        request.endpoint,
        result.status,
        'Unexpected login response',
        result.text,
      );
    }
    return result.body.slice(AUTH_TOKEN_PREFIX.length);
  }

  /** Resolves a token to its owner. */
  async checkToken(token: string): Promise<TokenInfo> {
    const request = requests.check(token);
    const result = await this.call<{ Item?: TokenInfo }>(request);
    if (!result.body.Item) {
      throw new DemoBlazeApiError(
        request.endpoint,
        result.status,
        'Missing Item in response',
        result.text,
      );
    }
    return result.body.Item;
  }

  /**
   * Adds a product to the authenticated user's cart. The line id is generated
   * up front, so a retried request cannot create a duplicate line.
   * @returns The cart line id, usable with {@link deleteItem}.
   */
  async addToCart(token: string, productId: number): Promise<string> {
    const id = cartItemId();
    await this.call(requests.addToCart(token, productId, id));
    return id;
  }

  /** Returns the cart lines of the authenticated user. */
  async viewCart(token: string): Promise<CartItem[]> {
    return (await this.callWithItems<CartResponse>(requests.viewCart(token))).Items;
  }

  /** Removes a single cart line by its id. */
  async deleteItem(id: string): Promise<void> {
    await this.call(requests.deleteItem(id));
  }

  /** Empties the cart of `owner`: a username, or a guest cart key (see `guestCartKey`). */
  async deleteCart(owner: string): Promise<void> {
    await this.call(requests.deleteCart(owner));
  }

  /** Returns the first page of products (the backend pages by 9). */
  async getEntries(): Promise<ProductPage> {
    return this.callWithItems<ProductPage>(requests.entries());
  }

  /** Returns the page of products that follows the product with id `afterId`. */
  async getPage(afterId: string | number): Promise<ProductPage> {
    return this.callWithItems<ProductPage>(requests.pagination(afterId));
  }

  /** Returns the full catalog by following pagination. */
  async getAllProducts(): Promise<Product[]> {
    const seen = new Map<number, Product>();
    let page = await this.getEntries();
    for (let guard = 0; guard < 20; guard += 1) {
      const before = seen.size;
      page.Items.forEach((product) => seen.set(product.id, product));
      const nextKey = page.LastEvaluatedKey?.id;
      if (!nextKey || seen.size === before || page.Items.length === 0) break;
      page = await this.getPage(nextKey);
    }
    return [...seen.values()].sort((a, b) => a.id - b.id);
  }

  /** Returns products of one category. */
  async getProductsByCategory(category: ProductCategory): Promise<Product[]> {
    return (await this.callWithItems<ProductPage>(requests.byCategory(category))).Items;
  }

  /** Returns a single product by id. */
  async getProduct(id: number): Promise<Product> {
    return (await this.call<Product>(requests.view(id))).body;
  }

  /**
   * Sends a business request with transient-failure retries, then rejects
   * HTTP errors and error envelopes.
   */
  private async call<T = unknown>(request: ApiRequest): Promise<ApiResult<T>> {
    const { result } = await this.send<T>(request);
    this.ensureOk(request, result);
    return result;
  }

  /** Like {@link call}, and also rejects a body without an `Items` list. */
  private async callWithItems<T extends { readonly Items: readonly unknown[] }>(
    request: ApiRequest,
  ): Promise<T> {
    const result = await this.call(request);
    if (!hasItems(result.body)) {
      throw new DemoBlazeApiError(request.endpoint, result.status, MISSING_ITEMS, result.text);
    }
    return result.body as unknown as T;
  }

  private async send<T>(request: ApiRequest): Promise<{ result: ApiResult<T>; attempts: number }> {
    let attempts = 0;
    const result = await withRetry(
      () => {
        attempts += 1;
        return this.raw<T>(request);
      },
      {
        ...this.retry,
        isRetryable: isTransient,
        onRetry: (outcome, attempt, delayMs) =>
          this.onRetry?.(
            `${request.endpoint} attempt ${attempt} failed (${describeOutcome(outcome)}); retrying in ${delayMs} ms`,
          ),
      },
    );
    return { result, attempts };
  }

  private ensureOk(request: ApiRequest, result: ApiResult): void {
    if (result.status < 200 || result.status >= 300) {
      throw new DemoBlazeApiError(
        request.endpoint,
        result.status,
        'Unexpected HTTP status',
        result.text,
      );
    }
    if (isErrorBody(result.body)) {
      throw new DemoBlazeApiError(
        request.endpoint,
        result.status,
        result.body.errorMessage,
        result.text,
      );
    }
  }
}
