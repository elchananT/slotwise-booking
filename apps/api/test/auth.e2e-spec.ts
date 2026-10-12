import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  bodyOf,
  createTestApp,
  HttpClient,
  resetDatabase,
} from './support/test-app';

interface AuthBody {
  owner: { id: string; email: string; name: string };
  accessToken: string;
  refreshToken: string;
}

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
}

describe('Owner auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: () => HttpClient;

  const credentials = {
    email: 'Owner@Example.com',
    name: 'Ada Owner',
    password: 'password123',
  };

  async function register(): Promise<AuthBody> {
    const res = await http()
      .post('/api/v1/auth/register')
      .send(credentials)
      .expect(201);
    return bodyOf<AuthBody>(res);
  }

  beforeAll(async () => {
    const ctx = await createTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
    http = ctx.http;
  });

  beforeEach(() => resetDatabase(prisma));

  afterAll(() => app.close());

  it('registers an owner with a normalised email and returns a token pair', async () => {
    const body = await register();

    expect(body.owner).toMatchObject({
      email: 'owner@example.com',
      name: 'Ada Owner',
    });
    expect(body.owner).not.toHaveProperty('passwordHash');
    expect(typeof body.accessToken).toBe('string');
    expect(typeof body.refreshToken).toBe('string');
  });

  it('rejects a duplicate email with 409 in the error envelope', async () => {
    await register();
    const res = await http()
      .post('/api/v1/auth/register')
      .send(credentials)
      .expect(409);

    expect(bodyOf<ErrorBody>(res)).toEqual({
      statusCode: 409,
      error: 'Conflict',
      message: 'An account with this email already exists',
    });
  });

  it('validates input and rejects unknown fields', async () => {
    const res = await http()
      .post('/api/v1/auth/register')
      .send({ email: 'nope', name: '', password: 'short', extra: true })
      .expect(400);

    const body = bodyOf<ErrorBody>(res);
    expect(body.statusCode).toBe(400);
    expect(body.message).toEqual(
      expect.arrayContaining([
        'email must be an email',
        'property extra should not exist',
      ]),
    );
  });

  it('logs in with the right password and rejects the wrong one with 401', async () => {
    await register();

    await http()
      .post('/api/v1/auth/login')
      .send({ email: credentials.email, password: 'wrong-password' })
      .expect(401);
    await http()
      .post('/api/v1/auth/login')
      .send({ email: 'missing@example.com', password: credentials.password })
      .expect(401);

    const res = await http()
      .post('/api/v1/auth/login')
      .send({ email: credentials.email, password: credentials.password })
      .expect(200);
    expect(bodyOf<AuthBody>(res).owner.email).toBe('owner@example.com');
  });

  it('serves /auth/me only with a valid access token', async () => {
    const { accessToken } = await register();

    await http().get('/api/v1/auth/me').expect(401);
    await http()
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer not-a-token')
      .expect(401);

    const res = await http()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const me = bodyOf<{ owner: { email: string }; business: null }>(res);
    expect(me.owner.email).toBe('owner@example.com');
    expect(me.business).toBeNull();
  });

  it('rotates refresh tokens and revokes every session when a spent token is replayed', async () => {
    const { refreshToken: first } = await register();

    const rotated = await http()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: first })
      .expect(200);
    const second = bodyOf<{ refreshToken: string }>(rotated).refreshToken;
    expect(second).not.toBe(first);

    await http()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: first })
      .expect(401);
    await http()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: second })
      .expect(401);
  });

  it('logout revokes the refresh token and returns 204', async () => {
    const { accessToken, refreshToken } = await register();

    await http()
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);
    await http()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });
});
