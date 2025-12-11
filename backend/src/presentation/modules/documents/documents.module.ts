import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { DocumentsController } from './documents.controller';
import { DocumentHandlers } from '../../../application/documents/document.handlers';
import { DocumentManager } from '../../../infrastructure/documents/document.manager';

@Module({
  imports: [CqrsModule],
  controllers: [DocumentsController],
  providers: [...DocumentHandlers, DocumentManager],
})
export class DocumentsModule {}
