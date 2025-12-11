import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';
import { TenantDto } from '~/enums/index';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly client: Stripe | null;

  constructor(configService: ConfigService) {
    const key = process.env.STRIPE_SECRET_KEY || '';
    this.client = key ? new Stripe(key, { apiVersion: '2023-10-16' }) : null;
    if (!key) {
      this.logger.warn('STRIPE_SECRET_KEY not set. Stripe operations are stubbed.');
    }
  }

  async createCustomerForTenant(tenant: TenantDto): Promise<void> {
    if (!this.client) {
      this.logger.log(`Stub Stripe customer creation for tenant ${tenant.id}`);
      return;
    }
    await this.client.customers.create({
      name: tenant.name,
      metadata: { tenantId: tenant.id },
    });
  }

  async createSubscription(tenant: TenantDto): Promise<void> {
    if (!this.client) {
      this.logger.log(`Stub Stripe subscription for tenant ${tenant.id}`);
      return;
    }
    this.logger.log(`Stripe subscription creation not implemented for tenant ${tenant.id}`);
  }
}
