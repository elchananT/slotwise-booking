import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { PUBLIC_THROTTLE } from '../common/throttling';
import { CreateBookingDto } from './dto/create-booking.dto';
import { RescheduleBookingDto } from './dto/reschedule-booking.dto';
import type { BookingDetailsView, CreatedBookingView } from './booking.views';
import { PublicBookingsService } from './public-bookings.service';

@ApiTags('public')
@Public()
@Throttle(PUBLIC_THROTTLE)
@Controller('public')
export class PublicBookingsController {
  constructor(private readonly bookings: PublicBookingsService) {}

  @Post(':slug/bookings')
  create(
    @Param('slug') slug: string,
    @Body() dto: CreateBookingDto,
  ): Promise<CreatedBookingView> {
    return this.bookings.create(slug, dto, new Date());
  }

  @Get('bookings/:manageToken')
  get(@Param('manageToken') manageToken: string): Promise<BookingDetailsView> {
    return this.bookings.getByToken(manageToken, new Date());
  }

  @Post('bookings/:manageToken/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @Param('manageToken') manageToken: string,
  ): Promise<BookingDetailsView> {
    return this.bookings.cancel(manageToken, new Date());
  }

  @Post('bookings/:manageToken/reschedule')
  @HttpCode(HttpStatus.OK)
  reschedule(
    @Param('manageToken') manageToken: string,
    @Body() dto: RescheduleBookingDto,
  ): Promise<BookingDetailsView> {
    return this.bookings.reschedule(manageToken, dto, new Date());
  }

  @Get('bookings/:manageToken/ics')
  async calendar(
    @Param('manageToken') manageToken: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<string> {
    const file = await this.bookings.calendarFile(manageToken, new Date());
    response.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    return file.content;
  }
}
