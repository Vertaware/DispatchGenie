import { BaseEntity } from '../common/base.entity';

export interface BankTransactionProps {
  id: string;
  tenantId: string;
  transactionCode: string;
  beneficiaryId: string;
  totalPaidAmount: number;
  paymentDocumentId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class BankTransaction extends BaseEntity<BankTransactionProps> {
  static create(props: BankTransactionProps): BankTransaction {
    return new BankTransaction(props);
  }
}
