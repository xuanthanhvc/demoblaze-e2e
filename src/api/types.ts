/** Product category values used by the backend. */
export type ProductCategory = 'phone' | 'notebook' | 'monitor';

/** Product as returned by `/entries`, `/pagination`, `/bycat` and `/view`. */
export interface Product {
  readonly id: number;
  readonly title: string;
  readonly price: number;
  readonly cat: ProductCategory | string;
  readonly desc: string;
  readonly img: string;
}

/** One page of products (`/entries`, `/pagination`). */
export interface ProductPage {
  readonly Items: Product[];
  readonly LastEvaluatedKey?: { readonly id: string };
  readonly ScannedCount?: number;
}

/** Cart line as stored by the backend. `cookie` holds the owner username. */
export interface CartItem {
  readonly id: string;
  readonly cookie: string;
  readonly prod_id: number;
}

/** Response of `/viewcart`. */
export interface CartResponse {
  readonly Items: CartItem[];
}

/** Response of `/check` for a valid token. */
export interface TokenInfo {
  readonly username: string;
  readonly token: string;
  readonly expiration: number;
}

/** Error envelope the backend returns with HTTP 200. */
export interface ApiErrorBody {
  readonly errorMessage: string;
}

/** Known backend error messages. */
export const API_ERRORS = {
  userExists: 'This user already exist.',
  wrongPassword: 'Wrong password.',
  userNotFound: 'User does not exist.',
  tokenMalformed: 'Bad parameter, token malformed.',
  tokenExpired: 'Token has expired',
  notFound: 'Not found.',
} as const;

/** Raw outcome of an API call, for tests that assert on status/body/latency. */
export interface ApiResult<T = unknown> {
  readonly status: number;
  readonly body: T;
  readonly text: string;
  readonly durationMs: number;
}
