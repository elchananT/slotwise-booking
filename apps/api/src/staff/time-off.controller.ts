import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedOwner } from '../auth/auth.types';
import { CurrentOwner } from '../common/decorators/current-owner.decorator';
import { TimeOffService } from './time-off.service';

@ApiTags('staff')
@ApiBearerAuth()
@Controller('time-off')
export class TimeOffController {
  constructor(private readonly timeOff: TimeOffService) {}

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentOwner() owner: AuthenticatedOwner,
    @Param('id') id: string,
  ): Promise<void> {
    return this.timeOff.remove(owner.id, id);
  }
}
