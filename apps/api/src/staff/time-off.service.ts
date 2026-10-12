import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { BusinessService } from '../business/business.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTimeOffDto } from './dto/create-time-off.dto';
import { requireStaffInBusiness } from './staff-access';
import { TimeOffView, toTimeOffView } from './time-off.view';

@Injectable()
export class TimeOffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly business: BusinessService,
  ) {}

  /**
   * Time off that overlaps confirmed bookings is refused with 409 unless the
   * owner passes force=true. Bookings are never cancelled automatically.
   */
  async create(
    ownerId: string,
    staffId: string,
    dto: CreateTimeOffDto,
    force: boolean,
  ): Promise<TimeOffView> {
    const { id: businessId } = await this.business.getForOwner(ownerId);
    await requireStaffInBusiness(this.prisma, businessId, staffId);

    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (endsAt <= startsAt) {
      throw new BadRequestException('endsAt must be after startsAt');
    }

    if (!force) {
      const conflicts = await this.prisma.booking.count({
        where: {
          staffId,
          status: BookingStatus.CONFIRMED,
          startsAt: { lt: endsAt },
          blockedUntil: { gt: startsAt },
        },
      });
      if (conflicts > 0) {
        throw new ConflictException(
          `Time off overlaps ${conflicts} confirmed booking(s); send force=true to create it anyway`,
        );
      }
    }

    const timeOff = await this.prisma.timeOff.create({
      data: { staffId, startsAt, endsAt, reason: dto.reason },
    });
    return toTimeOffView(timeOff);
  }

  async remove(ownerId: string, timeOffId: string): Promise<void> {
    const { id: businessId } = await this.business.getForOwner(ownerId);
    const timeOff = await this.prisma.timeOff.findFirst({
      where: { id: timeOffId, staff: { businessId } },
      select: { id: true },
    });
    if (!timeOff) {
      throw new NotFoundException('Time off not found');
    }
    await this.prisma.timeOff.delete({ where: { id: timeOffId } });
  }
}
