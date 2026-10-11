/**
 * Extracts the first number from a price-like string.
 *
 * Handles values such as `"$360 *includes tax"`, `"360"`, `"Amount: 1,150 USD"`
 * and `"790.00"`.
 *
 * @throws Error when no number is present.
 */
export function parseMoney(text: string): number {
  const match = /-?\d[\d,]*(?:\.\d+)?/.exec(text);
  if (!match) {
    throw new Error(`No monetary amount found in "${text}"`);
  }
  return Number(match[0].replace(/,/g, ''));
}

/** Sums a list of prices. */
export function sumPrices(prices: readonly number[]): number {
  return prices.reduce((total, price) => total + price, 0);
}
