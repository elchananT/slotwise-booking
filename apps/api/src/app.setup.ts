import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { getEnv } from './config/env';

export const API_PREFIX = 'api/v1';

/** Applies the global HTTP configuration shared by the server and the e2e tests. */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX);
  // JSON API responses do not need a CSP; disabling it lets Swagger UI load its inline assets.
  app.use(helmet({ contentSecurityPolicy: false }));
  app.enableCors({ origin: getEnv().WEB_ORIGIN });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Slotwise API')
      .setDescription('Booking platform for appointment businesses')
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('api/docs', app, document);
}
