import { BaseEntity } from '../common/base.entity';

export interface PaymentAllocationProps {
  id: string;
  tenantId: string;
  paymentRequestId: string;
  bankTransactionId: string;
  allocatedAmount: number;
  createdAt: Date;
}

export class PaymentAllocation extends BaseEntity<PaymentAllocationProps> {
  static create(props: PaymentAllocationProps): PaymentAllocation {
    return new PaymentAllocation(props);
  }
}
