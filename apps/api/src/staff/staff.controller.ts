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
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedOwner } from '../auth/auth.types';
import { CurrentOwner } from '../common/decorators/current-owner.decorator';
import { CreateStaffDto } from './dto/create-staff.dto';
import { CreateTimeOffDto } from './dto/create-time-off.dto';
import { ForceQueryDto } from './dto/force.query.dto';
import { SetHoursDto } from './dto/set-hours.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { StaffService } from './staff.service';
import type { StaffView, WorkingWindowView } from './staff.view';
import { TimeOffService } from './time-off.service';
import type { TimeOffView } from './time-off.view';

@ApiTags('staff')
@ApiBearerAuth()
@Controller('staff')
export class StaffController {
  constructor(
    private readonly staff: StaffService,
    private readonly timeOff: TimeOffService,
  ) {}

  @Get()
  list(@CurrentOwner() owner: AuthenticatedOwner): Promise<StaffView[]> {
    return this.staff.list(owner.id);
  }

  @Post()
  create(
    @CurrentOwner() owner: AuthenticatedOwner,
    @Body() dto: CreateStaffDto,
  ): Promise<StaffView> {
    return this.staff.create(owner.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentOwner() owner: AuthenticatedOwner,
    @Param('id') id: string,
    @Body() dto: UpdateStaffDto,
  ): Promise<StaffView> {
    return this.staff.update(owner.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentOwner() owner: AuthenticatedOwner,
    @Param('id') id: string,
  ): Promise<void> {
    return this.staff.remove(owner.id, id);
  }

  @Put(':id/hours')
  setHours(
    @CurrentOwner() owner: AuthenticatedOwner,
    @Param('id') id: string,
    @Body() dto: SetHoursDto,
  ): Promise<{ hours: WorkingWindowView[] }> {
    return this.staff.setHours(owner.id, id, dto);
  }

  @Post(':id/time-off')
  createTimeOff(
    @CurrentOwner() owner: AuthenticatedOwner,
    @Param('id') id: string,
    @Body() dto: CreateTimeOffDto,
    @Query() query: ForceQueryDto,
  ): Promise<TimeOffView> {
    return this.timeOff.create(owner.id, id, dto, query.force === true);
  }
}
