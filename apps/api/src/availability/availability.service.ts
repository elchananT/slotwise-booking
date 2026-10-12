import { Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, Business, Service } from '@prisma/client';
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

export interface DayAvailability {
  date: string;
  available: boolean;
}

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async slotsForDate(
    business: Business,
    service: Service,
    date: string,
    staffId: string | undefined,
    now: Date,
  ): Promise<AvailableSlot[]> {
    const day = parseLocalDate(date, business.timezone);
    const schedules = await this.loadSchedules(
      business,
      service,
      staffId,
      day.toMillis(),
      day.plus({ days: 1 }).toMillis(),
    );
    return computeDaySlots(
      engineInput(business, service, schedules, now, date),
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

  /**
   * Loads the schedules of the staff who can take the service (optionally one
   * named staff member). Time off and bookings are fetched with a one-day
   * margin, since a blocked range can run past the end of its day.
   */
  async loadSchedules(
    business: Business,
    service: Service,
    staffId: string | undefined,
    rangeStart: number,
    rangeEnd: number,
  ): Promise<StaffSchedule[]> {
    const staff = await this.prisma.staff.findMany({
      where: {
        businessId: business.id,
        active: true,
        services: { some: { serviceId: service.id } },
        id: staffId,
      },
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

    const bookings = await this.prisma.booking.findMany({
      where: {
        staffId: { in: staff.map((member) => member.id) },
        status: BookingStatus.CONFIRMED,
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
