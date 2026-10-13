import { Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, Business, Prisma, Service } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { computeDaySlots } from './availability.engine';
import {
  AvailableSlot,
  EngineInput,
  Interval,
  StaffSchedule,
} from './availability.types';
import { parseLocalDate, parseLocalMonth } from './local-date';

const DAY_MS = 24 * 60 * 60_000;

/** Either the root client or a client inside an interactive transaction. */
export type Db = Prisma.TransactionClient;

export interface DayAvailability {
  date: string;
  available: boolean;
}

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Bookable starts on one business-local day. Pass a transaction client and
   * the result reflects the locks already held by that transaction.
   */
  slotsOnDay(
    db: Db,
    business: Business,
    service: Service,
    date: string,
    staffId: string | undefined,
    now: Date,
    excludeBookingId?: string,
  ): Promise<AvailableSlot[]> {
    return this.computeSlots(
      db,
      business,
      service,
      date,
      staffId,
      now,
      excludeBookingId,
    );
  }

  async availabilityForMonth(
    business: Business,
    service: Service,
    month: string,
    staffId: string | undefined,
    now: Date,
  ): Promise<DayAvailability[]> {
    const first = parseLocalMonth(month, business.timezone);
    const schedules = await this.loadSchedules(
      this.prisma,
      business,
      service,
      staffId,
      first.toMillis(),
      first.plus({ months: 1 }).toMillis(),
    );

    const daysInMonth = first.daysInMonth ?? 0;
    return Array.from({ length: daysInMonth }, (_, offset) => {
      const date = first.plus({ days: offset }).toFormat('yyyy-MM-dd');
      const slots = computeDaySlots(
        engineInput(business, service, schedules, now, date),
      );
      return { date, available: slots.length > 0 };
    });
  }

  /** Ids of the active staff who offer the service, sorted for a stable lock order. */
  async eligibleStaffIds(
    db: Db,
    business: Business,
    service: Service,
    staffId: string | undefined,
  ): Promise<string[]> {
    const staff = await db.staff.findMany({
      where: eligibleStaffWhere(business, service, staffId),
      select: { id: true },
    });
    if (staffId !== undefined && staff.length === 0) {
      throw new NotFoundException('Staff member not found');
    }
    return staff.map((member) => member.id).sort();
  }

  private async computeSlots(
    db: Db,
    business: Business,
    service: Service,
    date: string,
    staffId: string | undefined,
    now: Date,
    excludeBookingId: string | undefined,
  ): Promise<AvailableSlot[]> {
    const day = parseLocalDate(date, business.timezone);
    const schedules = await this.loadSchedules(
      db,
      business,
      service,
      staffId,
      day.toMillis(),
      day.plus({ days: 1 }).toMillis(),
      excludeBookingId,
    );
    return computeDaySlots(
      engineInput(business, service, schedules, now, date),
    );
  }

  /**
   * Loads the schedules of the staff who can take the service, optionally one
   * named member. Time off and bookings are fetched with a one-day margin
   * because a blocked range can run past the end of its day.
   */
  async loadSchedules(
    db: Db,
    business: Business,
    service: Service,
    staffId: string | undefined,
    rangeStart: number,
    rangeEnd: number,
    excludeBookingId?: string,
  ): Promise<StaffSchedule[]> {
    const staff = await db.staff.findMany({
      where: eligibleStaffWhere(business, service, staffId),
      include: {
        hours: true,
        timeOff: {
          where: {
            startsAt: { lt: new Date(rangeEnd + DAY_MS) },
            endsAt: { gt: new Date(rangeStart - DAY_MS) },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
    if (staffId !== undefined && staff.length === 0) {
      throw new NotFoundException('Staff member not found');
    }

    const bookings = await db.booking.findMany({
      where: {
        staffId: { in: staff.map((member) => member.id) },
        status: BookingStatus.CONFIRMED,
        id: excludeBookingId ? { not: excludeBookingId } : undefined,
        startsAt: { lt: new Date(rangeEnd + DAY_MS) },
        blockedUntil: { gt: new Date(rangeStart - DAY_MS) },
      },
      select: { staffId: true, startsAt: true, blockedUntil: true },
    });

    return staff.map((member) => ({
      staffId: member.id,
      hours: member.hours.map(({ weekday, startMinute, endMinute }) => ({
        weekday,
        startMinute,
        endMinute,
      })),
      timeOff: member.timeOff.map(toInterval),
      bookings: bookings
        .filter((booking) => booking.staffId === member.id)
        .map((booking) =>
          toInterval({
            startsAt: booking.startsAt,
            endsAt: booking.blockedUntil,
          }),
        ),
    }));
  }
}

function eligibleStaffWhere(
  business: Business,
  service: Service,
  staffId: string | undefined,
): Prisma.StaffWhereInput {
  return {
    businessId: business.id,
    active: true,
    services: { some: { serviceId: service.id } },
    id: staffId,
  };
}

function engineInput(
  business: Business,
  service: Service,
  staff: StaffSchedule[],
  now: Date,
  date: string,
): EngineInput {
  return {
    timezone: business.timezone,
    date,
    now,
    durationMinutes: service.durationMinutes,
    bufferMinutes: service.bufferMinutes,
    minNoticeMinutes: business.minNoticeMinutes,
    maxAdvanceDays: business.maxAdvanceDays,
    staff,
  };
}

function toInterval(range: { startsAt: Date; endsAt: Date }): Interval {
  return { start: range.startsAt.getTime(), end: range.endsAt.getTime() };
}
