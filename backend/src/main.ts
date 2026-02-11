import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import cookieParser from 'cookie-parser';
import { join } from 'path';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const allowedOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const defaultOrigins = [
    'http://localhost',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
  ];

  // Use explicitly provided CORS_ORIGINS in production; fall back to local defaults when none provided
  const corsAllowlist =
    allowedOrigins.length > 0 ? allowedOrigins : defaultOrigins;

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      try {
        const url = new URL(origin);
        const originHost = `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}`;
        const originHostOnly = `${url.protocol}//${url.hostname}`;

        const allowed =
          corsAllowlist.includes(origin) ||
          corsAllowlist.includes(originHost) ||
          corsAllowlist.includes(originHostOnly) ||
          corsAllowlist.some((o) => {
            try {
              const oUrl = new URL(o);
              return oUrl.hostname === url.hostname;
            } catch {
              return o === origin || origin.endsWith(o);
            }
          });

        if (allowed) return callback(null, true);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        // fallback to basic check
        if (corsAllowlist.includes(origin)) return callback(null, true);
      }

      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[CORS] Rejected origin: ${origin}`);
      }
      return callback(new Error('CORS origin not allowed'), false);
    },
    credentials: true,
  });
  app.use(cookieParser());
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
