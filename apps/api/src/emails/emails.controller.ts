import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedOwner } from '../auth/auth.types';
import { CurrentOwner } from '../common/decorators/current-owner.decorator';
import { PaginationQueryDto, Page } from '../common/pagination';
import { EmailLogService, EmailView } from './email-log.service';

@ApiTags('emails')
@ApiBearerAuth()
@Controller('emails')
export class EmailsController {
  constructor(private readonly emails: EmailLogService) {}

  @Get()
  list(
    @CurrentOwner() owner: AuthenticatedOwner,
    @Query() query: PaginationQueryDto,
  ): Promise<Page<EmailView>> {
    return this.emails.list(owner.id, query);
  }
}
