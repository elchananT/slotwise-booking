import { HttpClient } from './test-app';
import { bodyOf } from './test-app';

export interface OwnerSession {
  accessToken: string;
  ownerId: string;
}

interface AuthBody {
  owner: { id: string };
  accessToken: string;
}

/** Registers an owner through the public API and returns a bearer session. */
export async function registerOwner(
  http: () => HttpClient,
  email: string,
): Promise<OwnerSession> {
  const res = await http()
    .post('/api/v1/auth/register')
    .send({ email, name: 'Test Owner', password: 'password123' })
    .expect(201);
  const body = bodyOf<AuthBody>(res);
  return { accessToken: body.accessToken, ownerId: body.owner.id };
}

export function asOwner(
  request: ReturnType<HttpClient['get']>,
  session: OwnerSession,
): ReturnType<HttpClient['get']> {
  return request.set('Authorization', `Bearer ${session.accessToken}`);
}
