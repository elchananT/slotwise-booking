import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, Business, Prisma } from '@prisma/client';
import { AvailabilityService } from '../availability/availability.service';
import { parseLocalDate } from '../availability/local-date';
import { BusinessService } from '../business/business.service';
import { PrismaService } from '../prisma/prisma.service';
import { Page, pageArgs } from '../common/pagination';
import {
  assertNoConflicts,
  blockedEndOf,
  endOf,
  lockStaff,
} from './booking-placement';
import {
  fullBookingInclude,
  OwnerBookingView,
  toOwnerBookingView,
} from './booking.views';
import { ListBookingsQueryDto } from './dto/list-bookings.query.dto';
import { RescheduleBookingDto } from './dto/reschedule-booking.dto';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class OwnerBookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly business: BusinessService,
    private readonly availability: AvailabilityService,
  ) {}

  async list(
    ownerId: string,
    query: ListBookingsQueryDto,
  ): Promise<Page<OwnerBookingView>> {
    const business = await this.business.getForOwner(ownerId);
    const where = bookingFilter(business, query);
    const { page, pageSize, skip, take } = pageArgs(query);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        include: fullBookingInclude,
        orderBy: { startsAt: 'asc' },
        skip,
        take,
      }),
      this.prisma.booking.count({ where }),
    ]);
    return { items: rows.map(toOwnerBookingView), page, pageSize, total };
  }

  async get(ownerId: string, bookingId: string): Promise<OwnerBookingView> {
    const { id: businessId } = await this.business.getForOwner(ownerId);
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, businessId },
      include: fullBookingInclude,
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    return toOwnerBookingView(booking);
  }

  async updateStatus(
    ownerId: string,
    bookingId: string,
    status: BookingStatus,
  ): Promise<OwnerBookingView> {
    const { id: businessId } = await this.business.getForOwner(ownerId);
    const result = await this.prisma.booking.updateMany({
      where: { id: bookingId, businessId, status: BookingStatus.CONFIRMED },
      data: { status },
    });
    if (result.count === 0) {
      await this.get(ownerId, bookingId);
      throw new ConflictException('Only confirmed bookings can change status');
    }
    return this.get(ownerId, bookingId);
  }

  /**
   * Owners may move a booking outside working hours, but never onto another
   * confirmed booking or time off. Past starts are refused.
   */
  async reschedule(
    ownerId: string,
    bookingId: string,
    dto: RescheduleBookingDto,
    now: Date,
  ): Promise<OwnerBookingView> {
    const business = await this.business.getForOwner(ownerId);
    const startsAt = new Date(dto.startsAt);
    if (startsAt.getTime() <= now.getTime()) {
      throw new BadRequestException('startsAt must be in the future');
    }

    await this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({
        where: { id: bookingId, businessId: business.id },
        include: fullBookingInclude,
      });
      if (!booking) {
        throw new NotFoundException('Booking not found');
      }
      if (booking.status !== BookingStatus.CONFIRMED) {
        throw new ConflictException(
          'Only confirmed bookings can be rescheduled',
        );
      }

      const staffId = dto.staffId ?? booking.staffId;
      await this.availability.eligibleStaffIds(
        tx,
        business,
        booking.service,
        staffId,
      );
      await lockStaff(tx, [booking.staffId, staffId]);

      const blockedUntil = blockedEndOf(
        startsAt,
        booking.service.durationMinutes,
        booking.service.bufferMinutes,
      );
      await assertNoConflicts(tx, staffId, startsAt, blockedUntil, booking.id);
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          startsAt,
          endsAt: endOf(startsAt, booking.service.durationMinutes),
          blockedUntil,
          staffId,
        },
      });
    });
    return this.get(ownerId, bookingId);
  }
}

function bookingFilter(
  business: Business,
  query: ListBookingsQueryDto,
): Prisma.BookingWhereInput {
  const search = query.q?.trim();
  return {
    businessId: business.id,
    staffId: query.staffId,
    status: query.status,
    startsAt: startsAtRange(query, business.timezone),
    OR: search
      ? [
          { customerName: { contains: search, mode: 'insensitive' } },
          { customerEmail: { contains: search, mode: 'insensitive' } },
          { reference: { contains: search, mode: 'insensitive' } },
        ]
      : undefined,
  };
}

/** Both bounds are inclusive. A day bound covers the whole business-local day. */
function startsAtRange(
  query: ListBookingsQueryDto,
  zone: string,
): Prisma.DateTimeFilter | undefined {
  const range: Prisma.DateTimeFilter = {};
  if (query.from !== undefined) {
    range.gte = DATE_ONLY.test(query.from)
      ? parseLocalDate(query.from, zone).toJSDate()
      : new Date(query.from);
  }
  if (query.to !== undefined) {
    if (DATE_ONLY.test(query.to)) {
      range.lt = parseLocalDate(query.to, zone).plus({ days: 1 }).toJSDate();
    } else {
      range.lte = new Date(query.to);
    }
  }
  return Object.keys(range).length > 0 ? range : undefined;
}
