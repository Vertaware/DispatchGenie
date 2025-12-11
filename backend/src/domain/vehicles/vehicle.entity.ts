import { BaseEntity } from '../common/base.entity';
import {
  LoadType,
  TruckType,
  VehicleInvoiceStatus,
  VehicleStatus,
} from '../../shared/enums/index';

export interface VehicleProps {
  id: string;
  tenantId: string;
  vehicleNumber: string;
  driverName?: string | null;
  driverPhoneNumber?: string | null;
  placedTruckSize?: string | null;
  placedTruckType?: TruckType | null;
  loadType?: LoadType | null;
  vehicleAmount?: number | null;
  vehicleExpense?: number | null;
  location?: string | null;
  locationReachedAt?: Date | null;
  unloadedAt?: Date | null;
  unloadedTime?: Date | null;
  billedOn?: Date | null;
  filledOn?: Date | null;
  dbWaitingTimeHours?: number | null;
  loadingQuantity?: number | null;
  checkInAt?: Date | null;
  gateInAt?: Date | null;
  gateOutAt?: Date | null;
  loadingStartedAt?: Date | null;
  loadingCompletedAt?: Date | null;
  status: VehicleStatus;
  invoiceStatus: VehicleInvoiceStatus;
  isPaid: boolean;
  profit?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Vehicle extends BaseEntity<VehicleProps> {
  static create(props: VehicleProps): Vehicle {
    return new Vehicle(props);
  }

  get vehicleExpense(): number {
    return this.props.vehicleExpense ?? 0;
  }

  get profit(): number {
    return this.props.profit ?? 0;
  }
}
