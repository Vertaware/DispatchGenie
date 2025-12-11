import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { SalesOrdersController } from './sales-orders.controller';
import { SalesOrderHandlers } from '../../../application/sales-orders/sales-orders.handlers';

@Module({
  imports: [CqrsModule],
  controllers: [SalesOrdersController],
  providers: [...SalesOrderHandlers],
})
export class SalesOrdersModule {}
