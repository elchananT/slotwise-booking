import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, HttpClient, resetDatabase } from './support/test-app';

describe('Rate limiting (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: () => HttpClient;
  let previousEnv: string | undefined;

  beforeAll(async () => {
    // Throttling is skipped under NODE_ENV=test so the other suites are not limited; enable it here.
    previousEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const ctx = await createTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
    http = ctx.http;
  });

  beforeEach(() => resetDatabase(prisma));

  afterAll(async () => {
    await app.close();
    process.env.NODE_ENV = previousEnv;
  });

  it('answers 429 to login attempts beyond 10 per minute', async () => {
    const attempt = () =>
      http()
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@example.com', password: 'password123' });

    for (let i = 0; i < 10; i++) {
      await attempt().expect(401);
    }
    const res = await attempt().expect(429);
    expect(res.body).toEqual(
      expect.objectContaining({ statusCode: 429, error: 'Too Many Requests' }),
    );
  }, 30_000);
});
