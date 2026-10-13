import { Module } from '@nestjs/common';
import { BusinessModule } from '../business/business.module';
import { EmailsController } from './emails.controller';
import { EmailLogService } from './email-log.service';

@Module({
  imports: [BusinessModule],
  controllers: [EmailsController],
  providers: [EmailLogService],
  exports: [EmailLogService],
})
export class EmailsModule {}
