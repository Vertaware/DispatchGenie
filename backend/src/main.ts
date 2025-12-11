import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './presentation/filters/http-exception.filter';
import { setupSwagger, SWAGGER_ENDPOINT } from './config/swagger.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? '*',
    credentials: true,
  });
  const enableSwaggerEnv = (process.env.ENABLE_SWAGGER ?? 'true').toLowerCase();
  const isSwaggerEnabled = enableSwaggerEnv !== 'false' && enableSwaggerEnv !== '0';

  if (isSwaggerEnabled) {
    setupSwagger(app);
  }

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);

  if (isSwaggerEnabled) {
    const appUrl = await app.getUrl();
    // eslint-disable-next-line no-console
    console.info(`Swagger docs available at ${appUrl}/${SWAGGER_ENDPOINT}`);
  }
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to bootstrap API', err);
  process.exit(1);
});
