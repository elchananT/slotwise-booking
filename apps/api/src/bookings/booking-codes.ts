import { randomBytes, randomInt } from 'node:crypto';

/** Upper-case letters and digits without the look-alikes 0, O, 1 and I. */
const REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const REFERENCE_LENGTH = 6;

/** Human-readable code shown to customers, e.g. SW-7K3Q9D. */
export function generateReference(): string {
  let code = '';
  for (let i = 0; i < REFERENCE_LENGTH; i++) {
    code += REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)];
  }
  return `SW-${code}`;
}

/** Unguessable bearer token for the customer's manage links (256 bits). */
export function generateManageToken(): string {
  return randomBytes(32).toString('base64url');
}
