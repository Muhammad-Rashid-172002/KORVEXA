import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { brand } from '@glasswork/shared';
import { cleanupOpenApiDoc } from 'nestjs-zod';

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle(`${brand.productName} API`)
    .setDescription(
      `${brand.lockup} REST API. Auth endpoints live under /v1/auth (Better Auth; reference at /v1/auth/reference in dev).`,
    )
    .setVersion('0.1.0')
    .addCookieAuth('gw.session_token')
    .addBearerAuth()
    .build();
  return cleanupOpenApiDoc(SwaggerModule.createDocument(app, config));
}

export function setupOpenApi(app: INestApplication): void {
  SwaggerModule.setup('v1/docs', app, () => buildOpenApiDocument(app), { jsonDocumentUrl: 'v1/openapi.json' });
}
