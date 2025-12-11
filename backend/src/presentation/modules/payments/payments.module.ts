import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PaymentsController } from './payments.controller';
import { PaymentHandlers } from '../../../application/payments/payments.handlers';
import { DocumentManager } from '../../../infrastructure/documents/document.manager';

@Module({
  imports: [CqrsModule],
  controllers: [PaymentsController],
  providers: [...PaymentHandlers, DocumentManager],
})
export class PaymentsModule {}
