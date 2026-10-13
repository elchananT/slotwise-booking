import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedOwner } from '../auth/auth.types';
import { CurrentOwner } from '../common/decorators/current-owner.decorator';
import { DashboardService, DashboardView } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  stats(@CurrentOwner() owner: AuthenticatedOwner): Promise<DashboardView> {
    return this.dashboard.stats(owner.id, new Date());
  }
}
