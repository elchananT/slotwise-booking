import type { Prisma } from '@prisma/client';

export const staffInclude = {
  services: {
    include: { service: { select: { id: true, name: true } } },
    orderBy: { service: { name: 'asc' } },
  },
  hours: { orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }] },
} satisfies Prisma.StaffInclude;

export type StaffWithRelations = Prisma.StaffGetPayload<{
  include: typeof staffInclude;
}>;

export interface WorkingWindowView {
  weekday: number;
  startMinute: number;
  endMinute: number;
}

export interface StaffView {
  id: string;
  name: string;
  title: string | null;
  active: boolean;
  serviceIds: string[];
  services: { id: string; name: string }[];
  hours: WorkingWindowView[];
}

export function toStaffView(staff: StaffWithRelations): StaffView {
  const services = staff.services.map(({ service }) => ({
    id: service.id,
    name: service.name,
  }));
  return {
    id: staff.id,
    name: staff.name,
    title: staff.title,
    active: staff.active,
    serviceIds: services.map((service) => service.id),
    services,
    hours: staff.hours.map(({ weekday, startMinute, endMinute }) => ({
      weekday,
      startMinute,
      endMinute,
    })),
  };
}
