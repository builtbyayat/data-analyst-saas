import { NestFactory } from '@nestjs/core';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module.js';

function parseAllowedOrigins(): string[] {
  const configured =
    process.env.ALLOWED_ORIGINS?.trim();

  if (!configured) {
    return ['http://localhost:3000'];
  }

  return configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function applySecurityHeaders(
  _request: Request,
  response: Response,
  next: NextFunction,
): void {
  response.setHeader(
    'X-Content-Type-Options',
    'nosniff',
  );

  response.setHeader(
    'X-Frame-Options',
    'DENY',
  );

  response.setHeader(
    'Referrer-Policy',
    'no-referrer',
  );

  response.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()',
  );

  response.setHeader(
    'Cross-Origin-Resource-Policy',
    'same-site',
  );

  if (
    process.env.NODE_ENV === 'production'
  ) {
    response.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains',
    );
  }

  next();
}

async function bootstrap() {
  const app =
    await NestFactory.create(
      AppModule,
      {
        rawBody: true,
      },
    );

  app.use(
    applySecurityHeaders,
  );

  app.enableCors({
    origin: parseAllowedOrigins(),
    methods: [
      'GET',
      'POST',
      'PATCH',
      'DELETE',
      'OPTIONS',
    ],
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'Accept',
    ],
    credentials: false,
  });

  await app.listen(
    process.env.PORT ?? 3000,
  );
}

await bootstrap();
