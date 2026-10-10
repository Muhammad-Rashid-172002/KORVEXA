import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE, DiscoveryModule } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { ZodValidationPipe } from 'nestjs-zod';
import { AuthModule } from './auth/auth.module';
import { AllExceptionsFilter } from './common/errors/http-exception.filter';
import { AuthGuard } from './common/policy/auth.guard';
import { RouteAuditService } from './common/policy/route-audit.service';
import { loadEnv } from './config/env';
import { InfraModule } from './infra/infra.module';
import { FilesModule } from './modules/files/files.module';
import { HealthController } from './modules/health/health.controller';
import { MeController } from './modules/me/me.controller';
import { PublicConfigController } from './modules/public-config/public-config.controller';
import { RealtimeModule } from './modules/realtime/realtime.module';

const env = loadEnv();

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: env.LOG_LEVEL,
        redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
        autoLogging: { ignore: (req) => req.url === '/health' || req.url === '/ready' },
        ...(env.NODE_ENV === 'development' && {
          transport: { target: 'pino-pretty', options: { singleLine: true, colorize: true } },
        }),
      },
    }),
    DiscoveryModule,
    InfraModule,
    AuthModule,
    FilesModule,
    RealtimeModule,
  ],
  controllers: [HealthController, MeController, PublicConfigController],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    RouteAuditService,
  ],
})
export class AppModule {}
