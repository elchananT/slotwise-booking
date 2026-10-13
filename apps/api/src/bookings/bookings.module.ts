import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module';
import { BusinessModule } from '../business/business.module';
import { EmailsModule } from '../emails/emails.module';
import { PublicModule } from '../public/public.module';
import { OwnerBookingsController } from './owner-bookings.controller';
import { OwnerBookingsService } from './owner-bookings.service';
import { PublicBookingsController } from './public-bookings.controller';
import { PublicBookingsService } from './public-bookings.service';

@Module({
  imports: [AvailabilityModule, BusinessModule, EmailsModule, PublicModule],
  controllers: [OwnerBookingsController, PublicBookingsController],
  providers: [OwnerBookingsService, PublicBookingsService],
})
export class BookingsModule {}
