import { ConflictException } from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import type { Db } from '../availability/availability.service';

export const SLOT_TAKEN_MESSAGE = 'That time is no longer available';

/**
 * Serialises writes per staff member. Advisory locks are taken in sorted order
 * and released when the transaction ends, so two requests for one professional
 * queue up instead of both seeing the slot as free.
 */
export async function lockStaff(db: Db, staffIds: string[]): Promise<void> {
  for (const staffId of [...new Set(staffIds)].sort()) {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${staffId}, 0))`;
  }
}

/** The staff member with the fewest confirmed bookings that day; ties keep the first in the list. */
export async function leastBusyStaff(
  db: Db,
  staffIds: string[],
  day: { start: Date; end: Date },
): Promise<string> {
  const loads = await db.booking.groupBy({
    by: ['staffId'],
    where: {
      staffId: { in: staffIds },
      status: BookingStatus.CONFIRMED,
      startsAt: { gte: day.start, lt: day.end },
    },
    _count: { _all: true },
  });
  const countFor = new Map(loads.map((row) => [row.staffId, row._count._all]));
  return staffIds.reduce((best, staffId) =>
    (countFor.get(staffId) ?? 0) < (countFor.get(best) ?? 0) ? staffId : best,
  );
}

/**
 * Rejects a blocked range [startsAt, blockedEnd) that overlaps another
 * confirmed booking or time off for the same staff member.
 */
export async function assertNoConflicts(
  db: Db,
  staffId: string,
  startsAt: Date,
  blockedEnd: Date,
  excludeBookingId?: string,
): Promise<void> {
  const bookingConflicts = await db.booking.count({
    where: {
      staffId,
      status: BookingStatus.CONFIRMED,
      id: excludeBookingId ? { not: excludeBookingId } : undefined,
      startsAt: { lt: blockedEnd },
      blockedUntil: { gt: startsAt },
    },
  });
  if (bookingConflicts > 0) {
    throw new ConflictException(SLOT_TAKEN_MESSAGE);
  }

  const timeOffConflicts = await db.timeOff.count({
    where: { staffId, startsAt: { lt: blockedEnd }, endsAt: { gt: startsAt } },
  });
  if (timeOffConflicts > 0) {
    throw new ConflictException(
      `${SLOT_TAKEN_MESSAGE}: the professional is off`,
    );
  }
}

export function blockedEndOf(
  startsAt: Date,
  durationMinutes: number,
  bufferMinutes: number,
): Date {
  return new Date(
    startsAt.getTime() + (durationMinutes + bufferMinutes) * 60_000,
  );
}

export function endOf(startsAt: Date, durationMinutes: number): Date {
  return new Date(startsAt.getTime() + durationMinutes * 60_000);
}

const MAX_REFERENCE_ATTEMPTS = 3;

/**
 * Reruns a create when a random reference or token collides with an existing
 * one. The unique index is the source of truth; a retry draws a new code.
 */
export async function retryOnUniqueCollision<T>(
  attempt: () => Promise<T>,
): Promise<T> {
  for (let tries = 1; ; tries++) {
    try {
      return await attempt();
    } catch (error) {
      if (tries < MAX_REFERENCE_ATTEMPTS && isUniqueViolation(error)) {
        continue;
      }
      throw error;
    }
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
