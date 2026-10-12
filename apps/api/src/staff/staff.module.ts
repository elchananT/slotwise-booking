import { Module } from '@nestjs/common';
import { BusinessModule } from '../business/business.module';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { TimeOffController } from './time-off.controller';
import { TimeOffService } from './time-off.service';

@Module({
  imports: [BusinessModule],
  controllers: [StaffController, TimeOffController],
  providers: [StaffService, TimeOffService],
})
export class StaffModule {}
