/** Owner login and registration: a brute-force guard. */
export const AUTH_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

/** Customer-facing booking routes, limited per IP. */
export const PUBLIC_THROTTLE = { default: { limit: 30, ttl: 60_000 } };
