/** A row of the cart table as shown in the UI. */
export interface CartRow {
  readonly title: string;
  readonly price: number;
}

/** Cart contents after the page has finished rendering every line. */
export interface CartSnapshot {
  readonly rows: readonly CartRow[];
  /** Displayed total; 0 when the cart is empty (the panel is blank). */
  readonly total: number;
}
