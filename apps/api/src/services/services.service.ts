import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessService } from '../business/business.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServiceView, toServiceView } from './service.view';

@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly business: BusinessService,
  ) {}

  async list(ownerId: string): Promise<ServiceView[]> {
    const { id: businessId } = await this.business.getForOwner(ownerId);
    const services = await this.prisma.service.findMany({
      where: { businessId },
      orderBy: { name: 'asc' },
    });
    return services.map(toServiceView);
  }

  async create(ownerId: string, dto: CreateServiceDto): Promise<ServiceView> {
    const { id: businessId } = await this.business.getForOwner(ownerId);
    const service = await this.prisma.service.create({
      data: { ...dto, businessId },
    });
    return toServiceView(service);
  }

  async update(
    ownerId: string,
    serviceId: string,
    dto: UpdateServiceDto,
  ): Promise<ServiceView> {
    await this.requireOwned(ownerId, serviceId);
    const service = await this.prisma.service.update({
      where: { id: serviceId },
      data: dto,
    });
    return toServiceView(service);
  }

  /**
   * Services that already have bookings are disabled rather than deleted,
   * so the booking history keeps its service name and price.
   */
  async remove(ownerId: string, serviceId: string): Promise<void> {
    await this.requireOwned(ownerId, serviceId);
    const bookingCount = await this.prisma.booking.count({
      where: { serviceId },
    });
    if (bookingCount > 0) {
      await this.prisma.service.update({
        where: { id: serviceId },
        data: { active: false },
      });
      return;
    }
    await this.prisma.service.delete({ where: { id: serviceId } });
  }

  private async requireOwned(
    ownerId: string,
    serviceId: string,
  ): Promise<void> {
    const { id: businessId } = await this.business.getForOwner(ownerId);
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, businessId },
      select: { id: true },
    });
    if (!service) {
      throw new NotFoundException('Service not found');
    }
  }
}
