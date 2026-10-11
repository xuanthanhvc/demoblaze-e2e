import type { Product } from '@api/types';

/** A product given by id, or a catalog product (its `id` is used). */
export type ProductRef = number | Pick<Product, 'id'>;

/** Title as the UI renders it: the API pads some titles with whitespace. */
export function displayTitle(product: Pick<Product, 'title'>): string {
  return product.title.trim();
}

/** Returns the catalog product with this display title. */
export function productByTitle(catalog: readonly Product[], title: string): Product {
  const product = catalog.find((p) => displayTitle(p) === title);
  if (!product) {
    throw new Error(`Product "${title}" not found in the catalog`);
  }
  return product;
}

/** Resolves several titles against the catalog, preserving the given order (duplicates allowed). */
export function productsByTitles(
  catalog: readonly Product[],
  titles: readonly string[],
): Product[] {
  return titles.map((title) => productByTitle(catalog, title));
}

/** Product ids in the same order as `products` (duplicates preserved). */
export function productIds(products: readonly ProductRef[]): number[] {
  return products.map((product) => (typeof product === 'number' ? product : product.id));
}
