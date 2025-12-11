import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { InvoicesController } from './invoices.controller';
import { InvoiceHandlers } from '../../../application/invoices/invoices.handlers';
import { DocumentManager } from '../../../infrastructure/documents/document.manager';

@Module({
  imports: [CqrsModule],
  controllers: [InvoicesController],
  providers: [...InvoiceHandlers, DocumentManager],
})
export class InvoicesModule {}
