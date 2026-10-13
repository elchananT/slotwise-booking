import { Injectable } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { localDayOf, parseLocalDate } from '../availability/local-date';
import { BusinessService } from '../business/business.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  bookingsByDay,
  completedRevenueCents,
  DashboardBooking,
  DayCount,
  ServiceCount,
  StaffUtilization,
  topServices,
  TOP_SERVICES_LIMIT,
  TREND_DAYS,
  trailingDates,
  utilizationPercent,
} from './dashboard.stats';

export interface DashboardView {
  todayCount: number;
  upcomingCount: number;
  revenueCentsLast30: number;
  bookingsByDay: DayCount[];
  topServices: ServiceCount[];
  utilizationByStaff: StaffUtilization[];
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly business: BusinessService,
  ) {}

  async stats(ownerId: string, now: Date): Promise<DashboardView> {
    const business = await this.business.getForOwner(ownerId);
    const zone = business.timezone;
    const today = localDayOf(now, zone);
    const dates = trailingDates(now, zone, TREND_DAYS);
    const windowStart = parseLocalDate(dates[0], zone).toJSDate();

    const [rows, todayCount, upcomingCount, staff] = await Promise.all([
      this.prisma.booking.findMany({
        where: {
          businessId: business.id,
          startsAt: { gte: windowStart, lt: today.end },
        },
        include: { service: { select: { name: true, priceCents: true } } },
      }),
      this.prisma.booking.count({
        where: {
          businessId: business.id,
          status: BookingStatus.CONFIRMED,
          startsAt: { gte: today.start, lt: today.end },
        },
      }),
      this.prisma.booking.count({
        where: {
          businessId: business.id,
          status: BookingStatus.CONFIRMED,
          startsAt: { gt: now },
        },
      }),
      this.prisma.staff.findMany({
        where: { businessId: business.id, active: true },
        include: { hours: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const bookings: DashboardBooking[] = rows.map((row) => ({
      status: row.status,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      staffId: row.staffId,
      serviceName: row.service.name,
      priceCents: row.service.priceCents,
    }));

    return {
      todayCount,
      upcomingCount,
      revenueCentsLast30: completedRevenueCents(bookings),
      bookingsByDay: bookingsByDay(bookings, dates, zone),
      topServices: topServices(bookings, TOP_SERVICES_LIMIT),
      utilizationByStaff: staff.map((member) => ({
        staffId: member.id,
        name: member.name,
        percent: utilizationPercent(
          bookings.filter((booking) => booking.staffId === member.id),
          member.hours,
          dates,
          zone,
        ),
      })),
    };
  }
}
