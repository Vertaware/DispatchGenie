import { type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const SWAGGER_ENDPOINT = 'docs';
export const SWAGGER_JSON_ENDPOINT = 'docs-json';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('LogisticsPro API')
    .setDescription('REST API documentation for the LogisticsPro platform.')
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        in: 'header',
        name: 'Authorization',
      },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    deepScanRoutes: true,
  });

  SwaggerModule.setup(SWAGGER_ENDPOINT, app, document, {
    jsonDocumentUrl: SWAGGER_JSON_ENDPOINT,
    customSiteTitle: 'LogisticsPro API Docs',
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
}
