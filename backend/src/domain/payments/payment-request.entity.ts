import { BaseEntity } from '../common/base.entity';
import {
  PaymentRequestStatus,
  PaymentRequestType,
} from '~/enums/index';

export interface PaymentRequestProps {
  id: string;
  tenantId: string;
  salesOrderId: string;
  vehicleId: string;
  transactionType: PaymentRequestType;
  requestedAmount: number;
  beneficiaryId: string;
  status: PaymentRequestStatus;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class PaymentRequest extends BaseEntity<PaymentRequestProps> {
  static create(props: PaymentRequestProps): PaymentRequest {
    return new PaymentRequest(props);
  }
}
