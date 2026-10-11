/** Order form data accepted by the Place Order modal. */
export interface OrderDetails {
  readonly name: string;
  readonly country: string;
  readonly city: string;
  readonly card: string;
  readonly month: string;
  readonly year: string;
}

/** TD-30: Name and Credit card of a valid order form. */
export const VALID_ORDER_FIELDS = { name: 'QA Tester', card: '4111111111111111' } as const;
