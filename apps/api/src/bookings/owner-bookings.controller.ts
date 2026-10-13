import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedOwner } from '../auth/auth.types';
import { CurrentOwner } from '../common/decorators/current-owner.decorator';
import type { Page } from '../common/pagination';
import { ListBookingsQueryDto } from './dto/list-bookings.query.dto';
import { RescheduleBookingDto } from './dto/reschedule-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { OwnerBookingsService } from './owner-bookings.service';
import type { OwnerBookingView } from './booking.views';

@ApiTags('bookings')
@ApiBearerAuth()
@Controller('bookings')
export class OwnerBookingsController {
  constructor(private readonly bookings: OwnerBookingsService) {}

  @Get()
  list(
    @CurrentOwner() owner: AuthenticatedOwner,
    @Query() query: ListBookingsQueryDto,
  ): Promise<Page<OwnerBookingView>> {
    return this.bookings.list(owner.id, query);
  }

  @Get(':id')
  get(
    @CurrentOwner() owner: AuthenticatedOwner,
    @Param('id') id: string,
  ): Promise<OwnerBookingView> {
    return this.bookings.get(owner.id, id);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentOwner() owner: AuthenticatedOwner,
    @Param('id') id: string,
    @Body() dto: UpdateBookingStatusDto,
  ): Promise<OwnerBookingView> {
    return this.bookings.updateStatus(owner.id, id, dto.status);
  }

  @Post(':id/reschedule')
  reschedule(
    @CurrentOwner() owner: AuthenticatedOwner,
    @Param('id') id: string,
    @Body() dto: RescheduleBookingDto,
  ): Promise<OwnerBookingView> {
    return this.bookings.reschedule(owner.id, id, dto, new Date());
  }
}
