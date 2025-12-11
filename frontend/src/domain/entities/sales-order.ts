export type SalesOrderStatus =
  | "INFORMATION_NEEDED"
  | "ASSIGN_VEHICLE"
  | "VEHICLE_ASSIGNED"
  | "ARRIVED"
  | "GATE_IN"
  | "LOADING_START"
  | "LOADING_COMPLETE"
  | "HOLD"
  | "DELETED"
  | "TRIP_INVOICED"
  | "GATE_OUT"
  | "IN_JOURNEY"
  | "COMPLETED"
  | "INVOICED"
  | "CANCELLED";

export type SalesOrderFieldSource = Record<string, "manual" | "import" | "image">;

export interface SalesOrderArticle {
  articleId?: string | null;
  articleDescription?: string | null;
  articleQuantity?: number | null;
}

export interface SalesOrder {
  id: string;
  tenantId: string;
  soNumber: string;
  soDate: string;
  customerId?: string | null;
  customerName?: string | null;
  partyName?: string | null;
  tripReferenceNo?: string | null;
  townName?: string | null;
  pinCode?: string | null;
  sku?: string | null;
  articleDescription?: string | null;
  soCases?: number | null;
  quantity?: number | null; // Legacy
  caseLot?: string | null;
  requestedTruckSize?: string | null;
  requestedTruckType?: string | null;
  placedTruckSize?: string | null;
  placedTruckType?: string | null;
  loadType?: string | null;
  loadingQuantity?: number | null;
  partyAddress?: string | null;
  vehicleAmount?: number | null;
  status: SalesOrderStatus;
  previousStatus?: SalesOrderStatus | null;
  finalAmount?: number | null;
  frightCost?: number | null;
  profit?: number | null;
  createdFromImport: boolean;
  fieldSource?: SalesOrderFieldSource | null;
  articles?: SalesOrderArticle[] | null;
  createdAt: string;
  updatedAt: string;
  vehicles?: Array<{
    vehicleAmount?: number | null;
    driverName?: string | null;
    driverPhoneNumber?: string | null;
    id: string;
    tenantId: string;
    vehicleNumber: string;
    vehicleName?: string | null;
    driverPhone?: string | null;
    truckSize?: string | null;
    truckType?: string | null;
    loadType?: string | null;
    shippingAmount?: number | null;
    shippingExpense?: number | null;
    location?: string | null;
    locationReachedAt?: string | null;
    unloadedAt?: string | null;
    billedOn?: string | null;
    filledOn?: string | null;
    dbWaitingTimeHours?: number | null;
    status: string;
    invoiceStatus: string;
    isPaid: boolean;
    profit?: number | null;
    createdAt: string;
    updatedAt: string;
  }>;
}
