/** Native alert texts produced by the DemoBlaze UI. */
export const UI_ALERTS = {
  fillLoginFields: 'Please fill out Username and Password.',
  wrongPassword: 'Wrong password.',
  userNotFound: 'User does not exist.',
  userExists: 'This user already exist.',
  signUpSuccess: 'Sign up successful.',
  /** Shown when a logged-in user adds a product. */
  productAdded: 'Product added.',
  /** Shown when a guest adds a product (no trailing period). */
  productAddedGuest: 'Product added',
  fillOrderFields: 'Please fill out Name and Creditcard.',
  tokenExpired: 'Your token has expired, please login again.',
} as const;

/** Navbar greeting shown to a logged-in user. */
export function welcomeText(username: string): string {
  return `Welcome ${username}`;
}

/** Title of the purchase confirmation SweetAlert. */
export const ORDER_CONFIRMATION_TITLE = 'Thank you for your purchase!';
