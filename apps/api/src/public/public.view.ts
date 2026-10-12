import type { Business, Service } from '@prisma/client';
import type { DayAvailability } from '../availability/availability.service';

export interface PublicBusinessView {
  name: string;
  slug: string;
  description: string | null;
  timezone: string;
  phone: string | null;
  address: string | null;
  minNoticeMinutes: number;
  maxAdvanceDays: number;
}

export interface PublicServiceView {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  bufferMinutes: number;
  priceCents: number;
  currency: string;
}

export interface PublicStaffView {
  id: string;
  name: string;
  title: string | null;
  serviceIds: string[];
}

export interface PublicBusinessPage {
  business: PublicBusinessView;
  services: PublicServiceView[];
  staff: PublicStaffView[];
}

export interface PublicAvailabilityView {
  date: string;
  timezone: string;
  slots: { start: string; staffIds: string[] }[];
}

export interface PublicMonthAvailabilityView {
  days: DayAvailability[];
}

export function toPublicBusinessView(business: Business): PublicBusinessView {
  return {
    name: business.name,
    slug: business.slug,
    description: business.description,
    timezone: business.timezone,
    phone: business.phone,
    address: business.address,
    minNoticeMinutes: business.minNoticeMinutes,
    maxAdvanceDays: business.maxAdvanceDays,
  };
}

export function toPublicServiceView(service: Service): PublicServiceView {
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    durationMinutes: service.durationMinutes,
    bufferMinutes: service.bufferMinutes,
    priceCents: service.priceCents,
    currency: service.currency,
  };
}
