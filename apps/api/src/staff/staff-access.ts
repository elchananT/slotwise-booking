import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Throws 404 for staff that do not belong to the business, so other owners' records stay invisible. */
export async function requireStaffInBusiness(
  prisma: PrismaService,
  businessId: string,
  staffId: string,
): Promise<void> {
  const staff = await prisma.staff.findFirst({
    where: { id: staffId, businessId },
    select: { id: true },
  });
  if (!staff) {
    throw new NotFoundException('Staff member not found');
  }
}
