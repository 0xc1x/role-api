import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
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
  const nodeEnv = config.get('NODE_ENV', { infer: true });

  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: corsOrigins, credentials: true });
  app.useGlobalFilters(new AllExceptionsFilter(config));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.use(helmet());
  app.use((req, res, next) => {
    res.setHeader('x-request-id', req.headers['x-request-id'] || crypto.randomUUID());
    next();
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Role API')
    .setDescription('Backend API para Role — marketplace de comida excedente')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'bearer',
    )
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);

  if (nodeEnv === 'production') {
    app.use(
      '/docs',
      (req, res, next) => {
        const auth = req.headers.authorization;
        const expected = `Basic ${Buffer.from(
          `${config.get('DOCS_USER')}:${config.get('DOCS_PASSWORD')}`,
        ).toString('base64')}`;
        if (auth !== expected) {
          res.setHeader('WWW-Authenticate', 'Basic realm="Docs"');
          return res.status(401).send('Unauthorized');
        }
        next();
      },
      apiReference({
        spec: { content: document },
        theme: 'purple',
      }),
    );
  } else {
    app.use(
      '/docs',
      apiReference({
        spec: { content: document },
        theme: 'purple',
      }),
    );
  }

  await app.listen(port);
  const logger = new Logger('Bootstrap');
  logger.log(`Role API listening on http://localhost:${port}`);
  logger.log(`Docs at http://localhost:${port}/docs`);
  logger.log(`Health at http://localhost:${port}/api/v1/health`);
}

bootstrap();
