import { BookingStatus, Prisma } from '@prisma/client';

export const fullBookingInclude = {
  business: true,
  service: true,
  staff: true,
} satisfies Prisma.BookingInclude;

export type FullBooking = Prisma.BookingGetPayload<{
  include: typeof fullBookingInclude;
}>;

interface ServiceSummary {
  id: string;
  name: string;
  durationMinutes: number;
  priceCents: number;
  currency: string;
}

interface StaffSummary {
  id: string;
  name: string;
  title: string | null;
}

function serviceSummary(booking: FullBooking): ServiceSummary {
  const { id, name, durationMinutes, priceCents, currency } = booking.service;
  return { id, name, durationMinutes, priceCents, currency };
}

function staffSummary(booking: FullBooking): StaffSummary {
  const { id, name, title } = booking.staff;
  return { id, name, title };
}

export interface OwnerBookingView {
  id: string;
  reference: string;
  status: BookingStatus;
  startsAt: Date;
  endsAt: Date;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  notes: string | null;
  createdAt: Date;
  service: ServiceSummary;
  staff: StaffSummary;
}

export function toOwnerBookingView(booking: FullBooking): OwnerBookingView {
  return {
    id: booking.id,
    reference: booking.reference,
    status: booking.status,
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    customerName: booking.customerName,
    customerEmail: booking.customerEmail,
    customerPhone: booking.customerPhone,
    notes: booking.notes,
    createdAt: booking.createdAt,
    service: serviceSummary(booking),
    staff: staffSummary(booking),
  };
}

/** What a customer sees on their manage page; `canChange` drives cancel and reschedule buttons. */
export interface BookingDetailsView {
  reference: string;
  status: BookingStatus;
  startsAt: Date;
  endsAt: Date;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  notes: string | null;
  service: ServiceSummary;
  staff: StaffSummary;
  business: {
    name: string;
    slug: string;
    timezone: string;
    phone: string | null;
    address: string | null;
  };
  canChange: boolean;
}

export interface CreatedBookingView extends BookingDetailsView {
  manageToken: string;
}

export function toBookingDetailsView(
  booking: FullBooking,
  canChange: boolean,
): BookingDetailsView {
  const { name, slug, timezone, phone, address } = booking.business;
  return {
    reference: booking.reference,
    status: booking.status,
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    customerName: booking.customerName,
    customerEmail: booking.customerEmail,
    customerPhone: booking.customerPhone,
    notes: booking.notes,
    service: serviceSummary(booking),
    staff: staffSummary(booking),
    business: { name, slug, timezone, phone, address },
    canChange,
  };
}
