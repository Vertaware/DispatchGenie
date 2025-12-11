import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TenantsController } from './tenants.controller';
import { TenantHandlers } from '../../../application/tenants/tenant.handlers';
import { StripeService } from '../../../infrastructure/adapters/stripe.service';

@Module({
  imports: [CqrsModule],
  controllers: [TenantsController],
  providers: [...TenantHandlers, StripeService],
})
export class TenantsModule {}
