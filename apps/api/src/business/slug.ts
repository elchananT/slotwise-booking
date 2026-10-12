import { randomBytes } from 'node:crypto';

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_BASE_LENGTH = 50;

/** Turns a business name into a URL slug; names without Latin letters fall back to "business". */
export function slugify(name: string): string {
  const base = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_BASE_LENGTH)
    .replace(/-+$/, '');
  return base || 'business';
}

/** Appends a short random suffix to a slug that is already taken. */
export function withRandomSuffix(base: string): string {
  return `${base}-${randomBytes(2).toString('hex')}`;
}
