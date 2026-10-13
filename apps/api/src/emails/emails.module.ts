import { Module } from '@nestjs/common';
import { EmailLogService } from './email-log.service';

@Module({
  providers: [EmailLogService],
  exports: [EmailLogService],
})
export class EmailsModule {}
