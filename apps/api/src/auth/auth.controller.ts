import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentOwner } from '../common/decorators/current-owner.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { AuthenticatedOwner } from './auth.types';
import { THROTTLE_AUTH } from './auth.constants';
import type { MeView } from './auth.service';
import { AuthService } from './auth.service';
import type { AuthResponseDto, TokenPairDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle(THROTTLE_AUTH)
  @Post('register')
  register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    return this.auth.register(dto);
  }

  @Public()
  @Throttle(THROTTLE_AUTH)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.auth.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto): Promise<TokenPairDto> {
    return this.auth.refresh(dto.refreshToken);
  }

  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@CurrentOwner() owner: AuthenticatedOwner): Promise<void> {
    return this.auth.logout(owner.id);
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentOwner() owner: AuthenticatedOwner): Promise<MeView> {
    return this.auth.me(owner.id);
  }
}
