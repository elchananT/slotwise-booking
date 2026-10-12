import type { Business } from '@prisma/client';

export interface BusinessView {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  timezone: string;
  phone: string | null;
  address: string | null;
  minNoticeMinutes: number;
  maxAdvanceDays: number;
}

export function toBusinessView(business: Business): BusinessView {
  return {
    id: business.id,
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
