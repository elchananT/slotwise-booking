import { existsSync } from 'node:fs';
import { join } from 'node:path';

export interface Env {
  readonly DATABASE_URL: string;
  readonly JWT_ACCESS_SECRET: string;
  readonly JWT_REFRESH_SECRET: string;
  readonly PORT: number;
  readonly WEB_ORIGIN: string;
}

let cached: Env | undefined;

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

/**
 * Loads apps/api/.env (variables already set in the environment win) and
 * validates the settings the API cannot start without.
 */
export function getEnv(): Env {
  if (!cached) {
    const envFile = join(__dirname, '..', '..', '.env');
    if (existsSync(envFile)) {
      process.loadEnvFile(envFile);
    }
    cached = {
      DATABASE_URL: required('DATABASE_URL'),
      JWT_ACCESS_SECRET: required('JWT_ACCESS_SECRET'),
      JWT_REFRESH_SECRET: required('JWT_REFRESH_SECRET'),
      PORT: Number(process.env.PORT ?? 4002),
      WEB_ORIGIN: process.env.WEB_ORIGIN ?? 'http://localhost:3102',
    };
  }
  return cached;
}
