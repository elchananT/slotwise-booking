import { Module } from '@nestjs/common';
import { BusinessModule } from '../business/business.module';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';

@Module({
  imports: [BusinessModule],
  controllers: [ServicesController],
  providers: [ServicesService],
})
export class ServicesModule {}
