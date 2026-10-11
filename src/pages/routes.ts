/** Paths of the DemoBlaze pages, relative to the configured base URL. */
export const ROUTES = {
  home: '/',
  cart: '/cart.html',
  product: (productId: number): string => `/prod.html?idp_=${productId}`,
} as const;

/** URL the site redirects to after logout or a confirmed purchase. */
export const HOME_REDIRECT_URL = /\/index\.html$/;
