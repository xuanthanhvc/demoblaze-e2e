/** Catalog titles used as test data (TD-20..TD-24). Prices are always read from the API. */
export const PRODUCT = {
  galaxyS6: 'Samsung galaxy s6',
  galaxyS7: 'Samsung galaxy s7',
  nexus6: 'Nexus 6',
  nokiaLumia1520: 'Nokia lumia 1520',
  sonyVaioI5: 'Sony vaio i5',
  sonyVaioI7: 'Sony vaio i7',
  sonyXperiaZ5: 'Sony xperia z5',
} as const;

/** Title of one of the {@link PRODUCT} test-data products. */
export type ProductTitle = (typeof PRODUCT)[keyof typeof PRODUCT];
