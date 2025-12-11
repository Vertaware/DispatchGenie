export type GateStatus = "CHECK_IN" | "GATE_IN" | "GATE_OUT" | "CANCELLED";

export interface Gate {
  id: string;
  tenantId: string;
  vehicleId?: string | null;
  vehicleNumber: string;
  salesOrderId?: string | null;
  soNumber?: string | null;
  status: GateStatus;
  checkInAt: string;
  gateInAt?: string | null;
  gateOutAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  // Vehicle details (if linked)
  vehicle?: {
    id: string;
    vehicleNumber: string;
    driverName?: string | null;
    driverPhoneNumber?: string | null;
    placedTruckSize?: string | null;
    placedTruckType?: string | null;
    status: string;
  } | null;
  // Sales order details (if linked)
  salesOrder?: {
    id: string;
    soNumber: string;
    status: string;
  } | null;
}
