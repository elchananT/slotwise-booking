import { DateTime } from 'luxon';
import { getEnv } from '../config/env';
import type { EmailToSend } from '../emails/email-log.service';
import type { FullBooking } from './booking.views';

function whenText(booking: FullBooking): string {
  return DateTime.fromJSDate(booking.startsAt)
    .setZone(booking.business.timezone)
    .toFormat("cccc d LLLL yyyy 'at' HH:mm ZZZZ");
}

function manageUrl(manageToken: string): string {
  return `${getEnv().WEB_ORIGIN}/booking/${manageToken}`;
}

export function confirmationEmail(booking: FullBooking): EmailToSend {
  return {
    businessId: booking.businessId,
    to: booking.customerEmail,
    subject: `Your booking ${booking.reference} is confirmed`,
    body: [
      `Hi ${booking.customerName},`,
      '',
      `Your ${booking.service.name} with ${booking.staff.name} at ${booking.business.name} is confirmed for ${whenText(booking)}.`,
      `Reference: ${booking.reference}`,
      `Manage your booking: ${manageUrl(booking.manageToken)}`,
    ].join('\n'),
  };
}

export function cancellationEmail(booking: FullBooking): EmailToSend {
  return {
    businessId: booking.businessId,
    to: booking.customerEmail,
    subject: `Your booking ${booking.reference} was cancelled`,
    body: [
      `Hi ${booking.customerName},`,
      '',
      `Your ${booking.service.name} at ${booking.business.name} on ${whenText(booking)} has been cancelled.`,
      `Reference: ${booking.reference}`,
    ].join('\n'),
  };
}
