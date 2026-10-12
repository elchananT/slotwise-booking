import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Owner, Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessView, toBusinessView } from '../business/business.view';
import { getEnv } from '../config/env';
import {
  ACCESS_TOKEN_TTL,
  BCRYPT_COST,
  DUMMY_PASSWORD_HASH,
  REFRESH_TOKEN_TTL,
} from './auth.constants';
import { AccessTokenPayload, RefreshTokenPayload } from './auth.types';
import { AuthResponseDto, TokenPairDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { OwnerView, toOwnerView } from './owner.view';

export interface MeView {
  owner: OwnerView;
  business: BusinessView | null;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);
    try {
      const owner = await this.prisma.owner.create({
        data: { email: dto.email, name: dto.name, passwordHash },
      });
      return this.issueSession(owner);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'An account with this email already exists',
        );
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const owner = await this.prisma.owner.findUnique({
      where: { email: dto.email },
    });
    const passwordMatches = await bcrypt.compare(
      dto.password,
      owner?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (!owner || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.issueSession(owner);
  }

  /**
   * Rotates the refresh token. The swap is a conditional update on the stored
   * hash, so a token can be spent only once. Presenting a valid but already
   * spent token means it leaked or was replayed, so every session is revoked.
   */
  async refresh(refreshToken: string): Promise<TokenPairDto> {
    const payload = await this.verifyRefreshToken(refreshToken);
    const next = await this.signRefreshToken(payload.sub);

    const rotated = await this.prisma.owner.updateMany({
      where: { id: payload.sub, refreshTokenHash: sha256(refreshToken) },
      data: { refreshTokenHash: sha256(next) },
    });
    if (rotated.count !== 1) {
      await this.prisma.owner.updateMany({
        where: { id: payload.sub },
        data: { refreshTokenHash: null },
      });
      throw new UnauthorizedException(
        'Refresh token is no longer valid; please log in again',
      );
    }

    return {
      accessToken: await this.signAccessToken(payload.sub),
      refreshToken: next,
    };
  }

  async logout(ownerId: string): Promise<void> {
    await this.prisma.owner.update({
      where: { id: ownerId },
      data: { refreshTokenHash: null },
    });
  }

  async me(ownerId: string): Promise<MeView> {
    const owner = await this.prisma.owner.findUniqueOrThrow({
      where: { id: ownerId },
      include: { business: true },
    });
    return {
      owner: toOwnerView(owner),
      business: owner.business ? toBusinessView(owner.business) : null,
    };
  }

  private async issueSession(owner: Owner): Promise<AuthResponseDto> {
    const refreshToken = await this.signRefreshToken(owner.id);
    await this.prisma.owner.update({
      where: { id: owner.id },
      data: { refreshTokenHash: sha256(refreshToken) },
    });
    return {
      owner: toOwnerView(owner),
      accessToken: await this.signAccessToken(owner.id),
      refreshToken,
    };
  }

  private signAccessToken(ownerId: string): Promise<string> {
    const payload: AccessTokenPayload = { sub: ownerId };
    return this.jwt.signAsync(payload, {
      secret: getEnv().JWT_ACCESS_SECRET,
      expiresIn: ACCESS_TOKEN_TTL,
    });
  }

  private signRefreshToken(ownerId: string): Promise<string> {
    const payload: RefreshTokenPayload = { sub: ownerId, jti: randomUUID() };
    return this.jwt.signAsync(payload, {
      secret: getEnv().JWT_REFRESH_SECRET,
      expiresIn: REFRESH_TOKEN_TTL,
    });
  }

  private async verifyRefreshToken(
    refreshToken: string,
  ): Promise<RefreshTokenPayload> {
    try {
      return await this.jwt.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: getEnv().JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }
}
