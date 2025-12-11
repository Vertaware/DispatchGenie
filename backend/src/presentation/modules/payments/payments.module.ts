import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PaymentsController } from './payments.controller';
import { PaymentHandlers } from '../../../application/payments/payments.handlers';
import { DocumentManager } from '../../../infrastructure/documents/document.manager';
import { LocalStorageService } from '../../../infrastructure/storage/local-storage.service';

@Module({
  imports: [CqrsModule],
  controllers: [PaymentsController],
  providers: [...PaymentHandlers, DocumentManager, LocalStorageService],
})
export class PaymentsModule {}
