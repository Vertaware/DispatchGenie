import { BaseEntity } from '../common/base.entity';
import { InvoiceStatus } from '~/enums/index';

export interface InvoiceProps {
  id: string;
  tenantId: string;
  invoiceNumber: string;
  date: Date;
  invoiceAmount: number;
  status: InvoiceStatus;
  paidDate?: Date | null;
  paidAmount?: number | null;
  invoiceDocumentId?: string | null;
  totalProfit?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Invoice extends BaseEntity<InvoiceProps> {
  static create(props: InvoiceProps): Invoice {
    return new Invoice(props);
  }
}
