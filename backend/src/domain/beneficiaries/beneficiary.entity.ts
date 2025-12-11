import { BaseEntity } from '../common/base.entity';

export interface BeneficiaryProps {
  id: string;
  tenantId: string;
  name: string;
  accountNumber: string;
  bankNameAndBranch: string;
  ifscCode: string;
  contactInfo?: string | null;
  documentId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Beneficiary extends BaseEntity<BeneficiaryProps> {
  static create(props: BeneficiaryProps): Beneficiary {
    return new Beneficiary(props);
  }
}
