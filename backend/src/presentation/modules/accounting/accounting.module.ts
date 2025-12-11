import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AccountingController } from './accounting.controller';
import { AccountingHandlers } from '../../../application/accounting/accounting.handlers';

@Module({
  imports: [CqrsModule],
  controllers: [AccountingController],
  providers: [...AccountingHandlers],
})
export class AccountingModule {}

