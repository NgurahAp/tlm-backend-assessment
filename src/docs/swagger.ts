import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Lumiere Backend Assessment API')
    .setDescription(
      'Backend API for the Lumiere technical assessment. Use X-Request-Id to correlate responses and structured logs.',
    )
    .setVersion('1.0.0')
    .addTag('Health', 'Application process health')
    .addTag('Orders', 'Read-only order and order item queries')
    .addTag('Checkout', 'Checkout and inventory validation')
    .addGlobalParameters({
      name: 'X-Request-Id',
      in: 'header',
      required: false,
      description:
        'Optional correlation ID. A UUID is generated when this header is omitted.',
      schema: {
        type: 'string',
        maxLength: 128,
        example: 'manual-request-001',
      },
    })
    .build();
  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs-json',
    customSiteTitle: 'Lumiere Backend Assessment API',
  });
}
