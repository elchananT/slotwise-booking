import type { Service } from '@prisma/client';

export interface ServiceView {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  bufferMinutes: number;
  priceCents: number;
  currency: string;
  active: boolean;
}

export function toServiceView(service: Service): ServiceView {
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    durationMinutes: service.durationMinutes,
    bufferMinutes: service.bufferMinutes,
    priceCents: service.priceCents,
    currency: service.currency,
    active: service.active,
  };
}
