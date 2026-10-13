import { Injectable } from '@nestjs/common';
import type { Db } from '../availability/availability.service';
import { BusinessService } from '../business/business.service';
import { Page, pageArgs, PaginationQueryDto } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';

export interface EmailToSend {
  businessId: string;
  to: string;
  subject: string;
  body: string;
}

export interface EmailView {
  id: string;
  to: string;
  subject: string;
  body: string;
  createdAt: Date;
}

/** "Sending" an email records it in EmailLog; no SMTP is involved. */
@Injectable()
export class EmailLogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly business: BusinessService,
  ) {}

  async record(db: Db, email: EmailToSend): Promise<void> {
    await db.emailLog.create({ data: email });
  }

  /** The owner's outbox, newest first. */
  async list(
    ownerId: string,
    query: PaginationQueryDto,
  ): Promise<Page<EmailView>> {
    const { id: businessId } = await this.business.getForOwner(ownerId);
    const { page, pageSize, skip, take } = pageArgs(query);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.emailLog.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.emailLog.count({ where: { businessId } }),
    ]);
    const items = rows.map(({ id, to, subject, body, createdAt }) => ({
      id,
      to,
      subject,
      body,
      createdAt,
    }));
    return { items, page, pageSize, total };
  }
}
