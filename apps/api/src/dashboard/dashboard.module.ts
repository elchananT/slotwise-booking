import { Module } from '@nestjs/common';
import { BusinessModule } from '../business/business.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [BusinessModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
