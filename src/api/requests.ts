import type { Request } from '@playwright/test';
import { cartItemId } from '@utils/data';
import { encodePassword } from '@utils/encoding';
import type { ProductCategory } from './types';

/** Backend endpoint paths. */
export const ENDPOINTS = {
  signup: '/signup',
  login: '/login',
  check: '/check',
  addToCart: '/addtocart',
  viewCart: '/viewcart',
  deleteItem: '/deleteitem',
  deleteCart: '/deletecart',
  entries: '/entries',
  pagination: '/pagination',
  byCategory: '/bycat',
  view: '/view',
} as const;

export type Endpoint = (typeof ENDPOINTS)[keyof typeof ENDPOINTS];

/**
 * True when the browser sent this request to `endpoint` as the site's real
 * POST call (not a CORS preflight). Use to wait for the page's own backend calls.
 */
export function isApiRequest(request: Request, endpoint: Endpoint): boolean {
  return request.method() === 'POST' && new URL(request.url()).pathname === endpoint;
}

/** One backend call: POST with a JSON body when `data` is set, otherwise GET. */
export interface ApiRequest {
  readonly endpoint: Endpoint;
  readonly data?: unknown;
}

/**
 * Request builders for every endpoint the suite calls. This is the only place
 * that knows the payload shapes, for business calls and raw contract calls
 * alike.
 *
 * Passwords are given in plain text and Base64-encoded like the UI does.
 * `cookie` carries the session token for `/addtocart` and `/viewcart`, but the
 * username (or guest cart key) for `/deletecart`.
 */
export const requests = {
  signup: (username: string, password: string): ApiRequest => ({
    endpoint: ENDPOINTS.signup,
    data: { username, password: encodePassword(password) },
  }),

  login: (username: string, password: string): ApiRequest => ({
    endpoint: ENDPOINTS.login,
    data: { username, password: encodePassword(password) },
  }),

  /** Resolves a session token to its owner. */
  check: (token: string): ApiRequest => ({ endpoint: ENDPOINTS.check, data: { token } }),

  /** The line id is chosen by the client (the UI uses a UUID too). */
  addToCart: (token: string, productId: number, id: string = cartItemId()): ApiRequest => ({
    endpoint: ENDPOINTS.addToCart,
    data: { id, cookie: token, prod_id: productId, flag: true },
  }),

  viewCart: (token: string): ApiRequest => ({
    endpoint: ENDPOINTS.viewCart,
    data: { cookie: token, flag: true },
  }),

  deleteItem: (id: string): ApiRequest => ({ endpoint: ENDPOINTS.deleteItem, data: { id } }),

  /** Keyed by username for accounts, or by the guest cart key for guests. */
  deleteCart: (owner: string): ApiRequest => ({
    endpoint: ENDPOINTS.deleteCart,
    data: { cookie: owner },
  }),

  /** First page of products (the backend pages by 9). */
  entries: (): ApiRequest => ({ endpoint: ENDPOINTS.entries }),

  /** Page of products that follows the product with id `afterId`. */
  pagination: (afterId: string | number): ApiRequest => ({
    endpoint: ENDPOINTS.pagination,
    data: { id: String(afterId) },
  }),

  byCategory: (category: ProductCategory): ApiRequest => ({
    endpoint: ENDPOINTS.byCategory,
    data: { cat: category },
  }),

  /** Sends the id as a string, as the product page does. */
  view: (productId: number): ApiRequest => ({
    endpoint: ENDPOINTS.view,
    data: { id: String(productId) },
  }),
} as const;
