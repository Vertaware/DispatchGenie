import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TransactionsController } from './transactions.controller';
import { TransactionHandlers } from '../../../application/transactions/transactions.handlers';
import { DocumentManager } from '../../../infrastructure/documents/document.manager';
import { LocalStorageService } from '../../../infrastructure/storage/local-storage.service';

@Module({
  imports: [CqrsModule],
  controllers: [TransactionsController],
  providers: [...TransactionHandlers, DocumentManager, LocalStorageService],
})
export class TransactionsModule {}
