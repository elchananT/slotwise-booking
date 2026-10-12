export interface AuthenticatedOwner {
  id: string;
}

export interface AccessTokenPayload {
  sub: string;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
}
