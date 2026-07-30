import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { parseCorsOrigins, type Env } from './config/env.schema';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  const config = app.get(ConfigService<Env, true>);
  const port = config.get('PORT', { infer: true });
  const corsOrigins = parseCorsOrigins(
    config.get('CORS_ORIGINS', { infer: true }),
  );

  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: corsOrigins, credentials: true });
  app.useGlobalFilters(new AllExceptionsFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Role API')
    .setDescription('Backend API para Role — marketplace de comida excedente')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);

  app.use(
    '/docs',
    apiReference({
      spec: { content: document },
      theme: 'purple',
    }),
  );

  await app.listen(port);
  const logger = new Logger('Bootstrap');
  logger.log(`Role API listening on http://localhost:${port}`);
  logger.log(`Docs at http://localhost:${port}/docs`);
  logger.log(`Health at http://localhost:${port}/api/v1/health`);
}

bootstrap();
