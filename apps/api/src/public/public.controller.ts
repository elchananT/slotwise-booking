import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { PUBLIC_THROTTLE } from '../common/throttling';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { MonthAvailabilityQueryDto } from './dto/month-availability-query.dto';
import { PublicService } from './public.service';
import type {
  PublicAvailabilityView,
  PublicBusinessPage,
  PublicMonthAvailabilityView,
} from './public.view';

@ApiTags('public')
@Public()
@Throttle(PUBLIC_THROTTLE)
@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get(':slug')
  getBusinessPage(@Param('slug') slug: string): Promise<PublicBusinessPage> {
    return this.publicService.getBusinessPage(slug);
  }

  @Get(':slug/availability')
  getAvailability(
    @Param('slug') slug: string,
    @Query() query: AvailabilityQueryDto,
  ): Promise<PublicAvailabilityView> {
    return this.publicService.getAvailability(slug, query, new Date());
  }

  @Get(':slug/availability/month')
  getMonthAvailability(
    @Param('slug') slug: string,
    @Query() query: MonthAvailabilityQueryDto,
  ): Promise<PublicMonthAvailabilityView> {
    return this.publicService.getMonthAvailability(slug, query, new Date());
  }
}
