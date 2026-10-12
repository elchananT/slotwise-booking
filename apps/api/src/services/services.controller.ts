import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedOwner } from '../auth/auth.types';
import { CurrentOwner } from '../common/decorators/current-owner.decorator';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import type { ServiceView } from './service.view';
import { ServicesService } from './services.service';

@ApiTags('services')
@ApiBearerAuth()
@Controller('services')
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Get()
  list(@CurrentOwner() owner: AuthenticatedOwner): Promise<ServiceView[]> {
    return this.services.list(owner.id);
  }

  @Post()
  create(
    @CurrentOwner() owner: AuthenticatedOwner,
    @Body() dto: CreateServiceDto,
  ): Promise<ServiceView> {
    return this.services.create(owner.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentOwner() owner: AuthenticatedOwner,
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
  ): Promise<ServiceView> {
    return this.services.update(owner.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentOwner() owner: AuthenticatedOwner,
    @Param('id') id: string,
  ): Promise<void> {
    return this.services.remove(owner.id, id);
  }
}
