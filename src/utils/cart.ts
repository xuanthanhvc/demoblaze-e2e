import type { Product } from '@api/types';
import type { CartRow, CartSnapshot } from '@data/cart';
import { displayTitle } from './catalog';
import { sumPrices } from './money';

/** Snapshot of a cart with no lines (the total panel is blank). */
export const EMPTY_CART: CartSnapshot = Object.freeze({ rows: [], total: 0 });

/** The cart row the UI renders for a product. */
export function cartRow(product: Product): CartRow {
  return { title: displayTitle(product), price: product.price };
}

/**
 * Cart rows in a canonical order. The site does not keep insertion order
 * (TC-CART-018), so compare carts as sorted lists.
 */
export function sortRows(rows: readonly CartRow[]): CartRow[] {
  return [...rows].sort((a, b) => a.title.localeCompare(b.title) || a.price - b.price);
}

/** Snapshot with rows sorted so cart comparisons are order-independent. */
export function normalizeCart(cart: CartSnapshot): CartSnapshot {
  return { rows: sortRows(cart.rows), total: cart.total };
}

/** Expected cart snapshot for the given products (rows sorted, total summed). */
export function expectedCart(products: readonly Product[]): CartSnapshot {
  const rows = products.map(cartRow);
  return normalizeCart({ rows, total: sumPrices(rows.map((row) => row.price)) });
}
