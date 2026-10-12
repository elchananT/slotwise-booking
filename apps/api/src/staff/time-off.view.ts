import type { TimeOff } from '@prisma/client';

export interface TimeOffView {
  id: string;
  staffId: string;
  startsAt: Date;
  endsAt: Date;
  reason: string | null;
}

export function toTimeOffView(timeOff: TimeOff): TimeOffView {
  return {
    id: timeOff.id,
    staffId: timeOff.staffId,
    startsAt: timeOff.startsAt,
    endsAt: timeOff.endsAt,
    reason: timeOff.reason,
  };
}
