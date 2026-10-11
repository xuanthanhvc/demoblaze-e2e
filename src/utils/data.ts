import { randomBytes, randomUUID } from 'node:crypto';
import { VALID_ORDER_FIELDS, type OrderDetails } from '@data/order';
import type { Credentials } from '@data/user';

/** Prefix that marks accounts created by this suite on the shared backend. */
export const USERNAME_PREFIX = 'qa_';

function randomToken(bytes = 4): string {
  return randomBytes(bytes).toString('hex');
}

/**
 * Generates a collision-resistant username: `qa_<timestamp>_<random>[_<tag>]`.
 * Safe across parallel workers and repeated runs.
 */
export function uniqueUsername(tag?: string): string {
  const suffix = tag ? `_${tag.replace(/[^a-z0-9]/gi, '').toLowerCase()}` : '';
  return `${USERNAME_PREFIX}${Date.now()}_${randomToken()}${suffix}`;
}

/** Generates a random password that contains letters, digits and a symbol. */
export function randomPassword(): string {
  return `Pw!${randomToken(6)}9`;
}

/** Generates a fresh, unregistered credential pair. */
export function uniqueCredentials(tag?: string): Credentials {
  return { username: uniqueUsername(tag), password: randomPassword() };
}

/** Generates an id in the same UUID format the UI uses for cart entries. */
export function cartItemId(): string {
  return randomUUID();
}

/** Builds valid order form data; individual fields can be overridden. */
export function orderDetails(overrides: Partial<OrderDetails> = {}): OrderDetails {
  return {
    name: `QA Buyer ${randomToken(2)}`,
    country: 'Vietnam',
    city: 'Ho Chi Minh City',
    card: VALID_ORDER_FIELDS.card,
    month: '12',
    year: String(new Date().getFullYear() + 2),
    ...overrides,
  };
}
