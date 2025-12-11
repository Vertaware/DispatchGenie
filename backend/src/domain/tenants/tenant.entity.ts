import { BaseEntity } from '../common/base.entity';
import { TenantSubscriptionStatus } from '~/enums/index';

export interface TenantProps {
  id: string;
  name: string;
  slug: string;
  stripeCustomerId?: string | null;
  subscriptionStatus: TenantSubscriptionStatus;
  trialEndsAt?: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class Tenant extends BaseEntity<TenantProps> {
  static create(props: TenantProps): Tenant {
    return new Tenant(props);
  }

  get id(): string {
    return this.props.id;
  }

  get subscriptionStatus(): TenantSubscriptionStatus {
    return this.props.subscriptionStatus;
  }

  get trialEndsAt(): Date | null | undefined {
    return this.props.trialEndsAt;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }
}
