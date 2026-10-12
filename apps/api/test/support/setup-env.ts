import { join } from 'node:path';

// Point the API at the dedicated test database before any module reads the environment.
process.loadEnvFile(join(__dirname, '..', '..', '.env'));
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
process.env.NODE_ENV = 'test';
