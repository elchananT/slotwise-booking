import { Injectable, NotFoundException } from '@nestjs/common';
import { Business, Service } from '@prisma/client';
import { AvailabilityService } from '../availability/availability.service';
import { PrismaService } from '../prisma/prisma.service';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { MonthAvailabilityQueryDto } from './dto/month-availability-query.dto';
import {
  PublicAvailabilityView,
  PublicBusinessPage,
  PublicMonthAvailabilityView,
  toPublicBusinessView,
  toPublicServiceView,
} from './public.view';

@Injectable()
export class PublicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
  ) {}

  async getBusinessPage(slug: string): Promise<PublicBusinessPage> {
    const business = await this.requireBusiness(slug);
    const [services, staff] = await Promise.all([
      this.prisma.service.findMany({
        where: { businessId: business.id, active: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.staff.findMany({
        where: { businessId: business.id, active: true },
        include: {
          services: {
            where: { service: { active: true } },
            select: { serviceId: true },
          },
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      business: toPublicBusinessView(business),
      services: services.map(toPublicServiceView),
      staff: staff.map((member) => ({
        id: member.id,
        name: member.name,
        title: member.title,
        serviceIds: member.services.map((link) => link.serviceId),
      })),
    };
  }

  async getAvailability(
    slug: string,
    query: AvailabilityQueryDto,
    now: Date,
  ): Promise<PublicAvailabilityView> {
    const business = await this.requireBusiness(slug);
    const service = await this.requireActiveService(business, query.serviceId);
    const slots = await this.availability.slotsOnDay(
      this.prisma,
      business,
      service,
      query.date,
      query.staffId,
      now,
    );
    return {
      date: query.date,
      timezone: business.timezone,
      slots: slots.map((slot) => ({
        start: slot.start.toISOString(),
        staffIds: slot.staffIds,
      })),
    };
  }

  async getMonthAvailability(
    slug: string,
    query: MonthAvailabilityQueryDto,
    now: Date,
  ): Promise<PublicMonthAvailabilityView> {
    const business = await this.requireBusiness(slug);
    const service = await this.requireActiveService(business, query.serviceId);
    const days = await this.availability.availabilityForMonth(
      business,
      service,
      query.month,
      query.staffId,
      now,
    );
    return { days };
  }

  async requireBusiness(slug: string): Promise<Business> {
    const business = await this.prisma.business.findUnique({ where: { slug } });
    if (!business) {
      throw new NotFoundException('Business not found');
    }
    return business;
  }

  async requireActiveService(
    business: Business,
    serviceId: string,
  ): Promise<Service> {
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, businessId: business.id, active: true },
    });
    if (!service) {
      throw new NotFoundException('Service not found');
    }
    return service;
  }
}
