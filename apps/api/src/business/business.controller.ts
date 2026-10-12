import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentOwner } from '../common/decorators/current-owner.decorator';
import type { AuthenticatedOwner } from '../auth/auth.types';
import { BusinessService } from './business.service';
import type { BusinessView } from './business.view';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';

@ApiTags('business')
@ApiBearerAuth()
@Controller('business')
export class BusinessController {
  constructor(private readonly business: BusinessService) {}

  @Post()
  create(
    @CurrentOwner() owner: AuthenticatedOwner,
    @Body() dto: CreateBusinessDto,
  ): Promise<BusinessView> {
    return this.business.create(owner.id, dto);
  }

  @Get()
  get(@CurrentOwner() owner: AuthenticatedOwner): Promise<BusinessView> {
    return this.business.get(owner.id);
  }

  @Patch()
  update(
    @CurrentOwner() owner: AuthenticatedOwner,
    @Body() dto: UpdateBusinessDto,
  ): Promise<BusinessView> {
    return this.business.update(owner.id, dto);
  }
}
