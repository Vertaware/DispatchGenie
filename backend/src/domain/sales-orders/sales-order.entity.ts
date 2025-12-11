import { BaseEntity } from '../common/base.entity';
import { SalesOrderStatus } from '~/enums/index';

export type FieldSource = Record<string, 'manual' | 'import' | 'image'>;

export interface SalesOrderProps {
  id: string;
  tenantId: string;
  soNumber: string;
  soDate: Date;
  customerId?: string | null;
  customerName?: string | null;
  partyName?: string | null;
  townName?: string | null;
  pinCode?: string | null;
  sku?: string | null;
  articleDescription?: string | null;
  soCases?: number | null;
  caseLot?: string | null;
  requestedTruckSize?: string | null;
  requestedTruckType?: string | null;
  category?: string | null;
  partyAddress?: string | null;
  status: SalesOrderStatus;
  finalAmount?: number | null;
  loadingQuantity?: number | null;
  createdFromImport: boolean;
  fieldSource?: FieldSource | null;
  createdAt: Date;
  updatedAt: Date;
}

export class SalesOrder extends BaseEntity<SalesOrderProps> {
  static create(props: SalesOrderProps): SalesOrder {
    return new SalesOrder(props);
  }

  get status(): SalesOrderStatus {
    return this.props.status;
  }
}
