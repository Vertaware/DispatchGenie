export type VehicleStatus =
  | "ASSIGNED"
  | "ARRIVED"
  | "GATE_IN"
  | "LOADING_START"
  | "LOADING_COMPLETE"
  | "GATE_OUT"
  | "IN_JOURNEY"
  | "COMPLETED"
  | "TRIP_INVOICED"
  | "INVOICED"
  | "CANCELLED"
  | "CREATED"
  | "COMPLETE"; // Legacy
export type VehicleInvoiceStatus = "NONE" | "INVOICE_CREATED" | "INVOICE_PAID";
export type TruckType = "OPEN" | "CLOSED";
export type LoadType = "SINGLE" | "CLUB";

export interface Vehicle {
  id: string;
  tenantId: string;
  asmPhoneNumber?: string | null;
  vehicleNumber: string;
  driverName?: string | null;
  vehicleName?: string | null; // Legacy
  driverPhoneNumber?: string | null;
  driverPhone?: string | null; // Legacy
  placedTruckSize?: string | null;
  truckSize?: string | null; // Legacy
  placedTruckType?: TruckType | null;
  truckType?: TruckType | null; // Legacy
  loadType?: LoadType | null;
  vehicleAmount?: number | null;
  shippingAmount?: number | null; // Legacy
  vehicleExpense?: number | null;
  shippingExpense?: number | null; // Legacy
  loadingQuantity?: number | null;
  checkInAt?: string | null;
  gateInAt?: string | null;
  gateOutAt?: string | null;
  loadingStartedAt?: string | null;
  loadingCompletedAt?: string | null;
  location?: string | null;
  locationReachedAt?: string | null;
  unloadedAt?: string | null;
  unloadedTime?: string | null;
  billedOn?: string | null;
  filledOn?: string | null;
  dbWaitingTimeHours?: number | null;
  status: VehicleStatus;
  invoiceStatus: VehicleInvoiceStatus;
  isPaid: boolean;
  profit?: number | null;
  createdAt: string;
  updatedAt: string;
}
