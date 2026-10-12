import type { Owner } from '@prisma/client';

export interface OwnerView {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

export function toOwnerView(owner: Owner): OwnerView {
  return {
    id: owner.id,
    email: owner.email,
    name: owner.name,
    createdAt: owner.createdAt,
  };
}
