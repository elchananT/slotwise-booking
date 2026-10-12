import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessService } from '../business/business.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { SetHoursDto, WorkingWindowDto } from './dto/set-hours.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { requireStaffInBusiness } from './staff-access';
import {
  staffInclude,
  StaffView,
  toStaffView,
  WorkingWindowView,
} from './staff.view';
import { assertValidWeeklyHours } from './working-hours';

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly business: BusinessService,
  ) {}

  async list(ownerId: string): Promise<StaffView[]> {
    const { id: businessId } = await this.business.getForOwner(ownerId);
    const staff = await this.prisma.staff.findMany({
      where: { businessId },
      include: staffInclude,
      orderBy: { name: 'asc' },
    });
    return staff.map(toStaffView);
  }

  async create(ownerId: string, dto: CreateStaffDto): Promise<StaffView> {
    const { id: businessId } = await this.business.getForOwner(ownerId);
    await this.requireServicesInBusiness(businessId, dto.serviceIds);
    const staff = await this.prisma.staff.create({
      data: {
        name: dto.name,
        title: dto.title,
        businessId,
        services: {
          create: dto.serviceIds.map((serviceId) => ({ serviceId })),
        },
      },
      include: staffInclude,
    });
    return toStaffView(staff);
  }

  async update(
    ownerId: string,
    staffId: string,
    dto: UpdateStaffDto,
  ): Promise<StaffView> {
    const { id: businessId } = await this.business.getForOwner(ownerId);
    await requireStaffInBusiness(this.prisma, businessId, staffId);
    if (dto.serviceIds) {
      await this.requireServicesInBusiness(businessId, dto.serviceIds);
    }
    const staff = await this.prisma.staff.update({
      where: { id: staffId },
      data: {
        name: dto.name,
        title: dto.title,
        active: dto.active,
        services: dto.serviceIds
          ? {
              deleteMany: {},
              create: dto.serviceIds.map((serviceId) => ({ serviceId })),
            }
          : undefined,
      },
      include: staffInclude,
    });
    return toStaffView(staff);
  }

  /** A staff member with bookings is deactivated rather than deleted, so the booking history stays intact. */
  async remove(ownerId: string, staffId: string): Promise<void> {
    const { id: businessId } = await this.business.getForOwner(ownerId);
    await requireStaffInBusiness(this.prisma, businessId, staffId);
    const bookingCount = await this.prisma.booking.count({
      where: { staffId },
    });
    if (bookingCount > 0) {
      await this.prisma.staff.update({
        where: { id: staffId },
        data: { active: false },
      });
      return;
    }
    await this.prisma.staff.delete({ where: { id: staffId } });
  }

  async setHours(
    ownerId: string,
    staffId: string,
    dto: SetHoursDto,
  ): Promise<{ hours: WorkingWindowView[] }> {
    const { id: businessId } = await this.business.getForOwner(ownerId);
    await requireStaffInBusiness(this.prisma, businessId, staffId);
    assertValidWeeklyHours(dto.hours);

    const staff = await this.prisma.staff.update({
      where: { id: staffId },
      data: {
        hours: {
          deleteMany: {},
          create: dto.hours.map(toHoursRow),
        },
      },
      include: staffInclude,
    });
    return { hours: toStaffView(staff).hours };
  }

  private async requireServicesInBusiness(
    businessId: string,
    serviceIds: string[],
  ): Promise<void> {
    const unique = [...new Set(serviceIds)];
    const found = await this.prisma.service.count({
      where: { id: { in: unique }, businessId },
    });
    if (found !== unique.length) {
      throw new NotFoundException('Service not found');
    }
  }
}

function toHoursRow(window: WorkingWindowDto): WorkingWindowView {
  return {
    weekday: window.weekday,
    startMinute: window.startMinute,
    endMinute: window.endMinute,
  };
}
