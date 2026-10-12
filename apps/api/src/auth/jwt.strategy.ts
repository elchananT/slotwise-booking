import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { getEnv } from '../config/env';
import { AccessTokenPayload, AuthenticatedOwner } from './auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getEnv().JWT_ACCESS_SECRET,
    });
  }

  validate(payload: AccessTokenPayload): AuthenticatedOwner {
    return { id: payload.sub };
  }
}
