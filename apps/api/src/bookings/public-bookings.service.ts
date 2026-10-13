import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { AvailabilityService } from '../availability/availability.service';
import { localDayOf } from '../availability/local-date';
import { PrismaService } from '../prisma/prisma.service';
import { PublicService } from '../public/public.service';
import { EmailLogService } from '../emails/email-log.service';
import { cancellationEmail, confirmationEmail } from './booking-emails';
import {
  assertNoConflicts,
  blockedEndOf,
  endOf,
  leastBusyStaff,
  lockStaff,
  retryOnUniqueCollision,
  SLOT_TAKEN_MESSAGE,
} from './booking-placement';
import {
  CANCELLATION_WINDOW_HOURS,
  isWithinChangeWindow,
} from './booking.rules';
import { generateManageToken, generateReference } from './booking-codes';
import {
  BookingDetailsView,
  CreatedBookingView,
  FullBooking,
  fullBookingInclude,
  toBookingDetailsView,
} from './booking.views';
import { buildIcs } from './ics';
import { CreateBookingDto } from './dto/create-booking.dto';
import { RescheduleBookingDto } from './dto/reschedule-booking.dto';

export interface CalendarFile {
  content: string;
  filename: string;
}

@Injectable()
export class PublicBookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publicLookup: PublicService,
    private readonly availability: AvailabilityService,
    private readonly emails: EmailLogService,
  ) {}

  /**
   * Books a slot. The staff locks, the availability check and the insert all run
   * in one transaction, so concurrent requests for the same slot serialise and
   * the loser gets 409.
   */
  async create(
    slug: string,
    dto: CreateBookingDto,
    now: Date,
  ): Promise<CreatedBookingView> {
    const business = await this.publicLookup.requireBusiness(slug);
    const service = await this.publicLookup.requireActiveService(
      business,
      dto.serviceId,
    );
    const startsAt = new Date(dto.startsAt);
    const day = localDayOf(startsAt, business.timezone);

    const booking = await retryOnUniqueCollision(() =>
      this.prisma.$transaction(async (tx) => {
        const eligible = await this.availability.eligibleStaffIds(
          tx,
          business,
          service,
          dto.staffId,
        );
        await lockStaff(tx, eligible);

        const slots = await this.availability.slotsOnDay(
          tx,
          business,
          service,
          day.date,
          dto.staffId,
          now,
        );
        const slot = slots.find(
          (candidate) => candidate.start.getTime() === startsAt.getTime(),
        );
        if (!slot) {
          throw new ConflictException(SLOT_TAKEN_MESSAGE);
        }

        const staffId = await leastBusyStaff(tx, slot.staffIds, day);
        const blockedUntil = blockedEndOf(
          startsAt,
          service.durationMinutes,
          service.bufferMinutes,
        );
        await assertNoConflicts(tx, staffId, startsAt, blockedUntil);

        const created = await tx.booking.create({
          data: {
            reference: generateReference(),
            manageToken: generateManageToken(),
            startsAt,
            endsAt: endOf(startsAt, service.durationMinutes),
            blockedUntil,
            customerName: dto.customerName,
            customerEmail: dto.customerEmail,
            customerPhone: dto.customerPhone,
            notes: dto.notes,
            businessId: business.id,
            serviceId: service.id,
            staffId,
          },
          include: fullBookingInclude,
        });
        await this.emails.record(tx, confirmationEmail(created));
        return created;
      }),
    );

    return {
      ...toBookingDetailsView(
        booking,
        isWithinChangeWindow(booking.status, booking.startsAt, now),
      ),
      manageToken: booking.manageToken,
    };
  }

  async getByToken(
    manageToken: string,
    now: Date,
  ): Promise<BookingDetailsView> {
    const booking = await this.requireByToken(manageToken);
    return this.toDetails(booking, now);
  }

  async cancel(manageToken: string, now: Date): Promise<BookingDetailsView> {
    const booking = await this.requireByToken(manageToken);
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new ConflictException('Only confirmed bookings can be cancelled');
    }
    if (!isWithinChangeWindow(booking.status, booking.startsAt, now)) {
      throw new ConflictException(
        `Bookings can only be cancelled until ${CANCELLATION_WINDOW_HOURS} hours before the appointment`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // The conditional update makes a double-submitted cancel a single state change and a single email.
      const result = await tx.booking.updateMany({
        where: { id: booking.id, status: BookingStatus.CONFIRMED },
        data: { status: BookingStatus.CANCELLED },
      });
      if (result.count === 0) {
        throw new ConflictException('Only confirmed bookings can be cancelled');
      }
      const cancelled = await tx.booking.findUniqueOrThrow({
        where: { id: booking.id },
        include: fullBookingInclude,
      });
      await this.emails.record(tx, cancellationEmail(cancelled));
    });
    return this.getByToken(manageToken, now);
  }

  async reschedule(
    manageToken: string,
    dto: RescheduleBookingDto,
    now: Date,
  ): Promise<BookingDetailsView> {
    const current = await this.requireByToken(manageToken);
    if (current.status !== BookingStatus.CONFIRMED) {
      throw new ConflictException('Only confirmed bookings can be rescheduled');
    }
    if (!isWithinChangeWindow(current.status, current.startsAt, now)) {
      throw new ConflictException(
        `Bookings can only be rescheduled until ${CANCELLATION_WINDOW_HOURS} hours before the appointment`,
      );
    }

    const { business, service } = current;
    const startsAt = new Date(dto.startsAt);
    const day = localDayOf(startsAt, business.timezone);
    const staffId = dto.staffId ?? current.staffId;

    await this.prisma.$transaction(async (tx) => {
      await this.availability.eligibleStaffIds(tx, business, service, staffId);
      await lockStaff(tx, [current.staffId, staffId]);

      const slots = await this.availability.slotsOnDay(
        tx,
        business,
        service,
        day.date,
        staffId,
        now,
        current.id,
      );
      if (!slots.some((slot) => slot.start.getTime() === startsAt.getTime())) {
        throw new ConflictException(SLOT_TAKEN_MESSAGE);
      }
      const blockedUntil = blockedEndOf(
        startsAt,
        service.durationMinutes,
        service.bufferMinutes,
      );
      await assertNoConflicts(tx, staffId, startsAt, blockedUntil, current.id);

      await tx.booking.update({
        where: { id: current.id },
        data: {
          startsAt,
          endsAt: endOf(startsAt, service.durationMinutes),
          blockedUntil,
          staffId,
        },
      });
    });
    return this.getByToken(manageToken, now);
  }

  async calendarFile(manageToken: string, now: Date): Promise<CalendarFile> {
    const booking = await this.requireByToken(manageToken);
    return {
      filename: `${booking.reference}.ics`,
      content: buildIcs({
        uid: `${booking.reference}@slotwise`,
        stamp: now,
        start: booking.startsAt,
        end: booking.endsAt,
        summary: `${booking.service.name} at ${booking.business.name}`,
        description: `Booking reference ${booking.reference}`,
        location: booking.business.address ?? booking.business.name,
        cancelled: booking.status === BookingStatus.CANCELLED,
      }),
    };
  }

  private toDetails(booking: FullBooking, now: Date): BookingDetailsView {
    return toBookingDetailsView(
      booking,
      isWithinChangeWindow(booking.status, booking.startsAt, now),
    );
  }

  private async requireByToken(manageToken: string): Promise<FullBooking> {
    const booking = await this.prisma.booking.findUnique({
      where: { manageToken },
      include: fullBookingInclude,
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    return booking;
  }
}
