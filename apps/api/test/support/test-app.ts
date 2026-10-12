import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { PrismaService } from '../../src/prisma/prisma.service';

export type HttpClient = ReturnType<typeof request>;

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
  http: () => HttpClient;
}

export async function createTestApp(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  const prisma = app.get(PrismaService);
  return {
    app,
    prisma,
    http: () => request(app.getHttpServer() as Server),
  };
}

const TABLES = [
  'EmailLog',
  'Booking',
  'TimeOff',
  'WorkingHours',
  'StaffService',
  'Staff',
  'Service',
  'Business',
  'Owner',
];

export async function resetDatabase(prisma: PrismaService): Promise<void> {
  const tables = TABLES.map((table) => `"${table}"`).join(', ');
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`,
  );
}

/** Types a supertest response body, which the library types as `any`. */
export function bodyOf<T>(response: { body: unknown }): T {
  return response.body as T;
}
