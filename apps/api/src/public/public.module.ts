import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';

@Module({
  imports: [AvailabilityModule],
  controllers: [PublicController],
  providers: [PublicService],
  exports: [PublicService],
})
export class PublicModule {}
