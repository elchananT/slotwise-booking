import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Business, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { BusinessView, toBusinessView } from './business.view';
import { slugify, withRandomSuffix } from './slug';

const SLUG_TAKEN = 'That URL slug is already taken';

/** Two concurrent writes can pass the pre-checks; the unique index then decides, and that maps to 409. */
function rethrowAsConflict(error: unknown, message: string): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw new ConflictException(message);
  }
  throw error;
}

@Injectable()
export class BusinessService {
  constructor(private readonly prisma: PrismaService) {}

  /** Resolves the owner's business; every owner-scoped query is built from this id. */
  async getForOwner(ownerId: string): Promise<Business> {
    const business = await this.prisma.business.findUnique({
      where: { ownerId },
    });
    if (!business) {
      throw new NotFoundException('Business not found');
    }
    return business;
  }

  async create(ownerId: string, dto: CreateBusinessDto): Promise<BusinessView> {
    const existing = await this.prisma.business.findUnique({
      where: { ownerId },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('This account already has a business');
    }

    const slug = dto.slug
      ? await this.requireFreeSlug(dto.slug)
      : await this.generateSlug(dto.name);
    try {
      const business = await this.prisma.business.create({
        data: { ...dto, slug, ownerId },
      });
      return toBusinessView(business);
    } catch (error) {
      rethrowAsConflict(error, 'This account already has a business');
    }
  }

  async get(ownerId: string): Promise<BusinessView> {
    return toBusinessView(await this.getForOwner(ownerId));
  }

  async update(ownerId: string, dto: UpdateBusinessDto): Promise<BusinessView> {
    const current = await this.getForOwner(ownerId);
    if (dto.slug !== undefined && dto.slug !== current.slug) {
      await this.requireFreeSlug(dto.slug);
    }
    try {
      const business = await this.prisma.business.update({
        where: { id: current.id },
        data: dto,
      });
      return toBusinessView(business);
    } catch (error) {
      rethrowAsConflict(error, SLUG_TAKEN);
    }
  }

  private async requireFreeSlug(slug: string): Promise<string> {
    if (await this.slugExists(slug)) {
      throw new ConflictException(SLUG_TAKEN);
    }
    return slug;
  }

  private async generateSlug(name: string): Promise<string> {
    const base = slugify(name);
    let candidate = base;
    while (await this.slugExists(candidate)) {
      candidate = withRandomSuffix(base);
    }
    return candidate;
  }

  private async slugExists(slug: string): Promise<boolean> {
    const found = await this.prisma.business.findUnique({
      where: { slug },
      select: { id: true },
    });
    return found !== null;
  }
}
