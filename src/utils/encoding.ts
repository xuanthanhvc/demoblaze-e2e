/**
 * Encodes a password exactly like the DemoBlaze UI does before sending it to
 * the API (`btoa` over UTF-8 bytes), so non-ASCII passwords match too.
 */
export function encodePassword(plain: string): string {
  return Buffer.from(plain, 'utf8').toString('base64');
}
