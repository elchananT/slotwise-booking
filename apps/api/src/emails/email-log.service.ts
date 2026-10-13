import { Injectable } from '@nestjs/common';
import type { Db } from '../availability/availability.service';

export interface EmailToSend {
  businessId: string;
  to: string;
  subject: string;
  body: string;
}

/** "Sending" an email records it in EmailLog; no SMTP is involved. */
@Injectable()
export class EmailLogService {
  async record(db: Db, email: EmailToSend): Promise<void> {
    await db.emailLog.create({ data: email });
  }
}
