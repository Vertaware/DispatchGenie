import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import configuration from './config/configuration';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { AuthModule } from './presentation/modules/auth/auth.module';
import { TenantsModule } from './presentation/modules/tenants/tenants.module';
import { UsersModule } from './presentation/modules/users/users.module';
import { SalesOrdersModule } from './presentation/modules/sales-orders/sales-orders.module';
import { VehiclesModule } from './presentation/modules/vehicles/vehicles.module';
import { PaymentsModule } from './presentation/modules/payments/payments.module';
import { TransactionsModule } from './presentation/modules/transactions/transactions.module';
import { BeneficiariesModule } from './presentation/modules/beneficiaries/beneficiaries.module';
import { InvoicesModule } from './presentation/modules/invoices/invoices.module';
import { DocumentsModule } from './presentation/modules/documents/documents.module';
import { GateModule } from './presentation/modules/gate/gate.module';
import { AccountingModule } from './presentation/modules/accounting/accounting.module';
import { ArticlesModule } from './presentation/modules/articles/articles.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    CqrsModule,
    PrismaModule,
    AuthModule,
    TenantsModule,
    UsersModule,
    SalesOrdersModule,
    VehiclesModule,
    PaymentsModule,
    TransactionsModule,
    BeneficiariesModule,
    InvoicesModule,
    DocumentsModule,
    GateModule,
    AccountingModule,
    ArticlesModule,
  ],
})
export class AppModule {}
