export type InvoiceStatus = "DRAFT" | "PAID";

export interface Invoice {
  id: string;
  tenantId: string;
  invoiceNumber: string;
  date: string;
  invoiceAmount: number;
  status: InvoiceStatus;
  paidDate?: string | null;
  paidAmount?: number | null;
  invoiceDocumentId?: string | null;
  totalProfit?: number | null;
  createdAt: string;
  updatedAt: string;
  // Vehicle and expense fields
  vehicleNumber?: string | null;
  driverPhone?: string | null;
  vehicleAmount?: number | null;
  locationReachedAt?: string | null;
  unloadedDate?: string | null;
  dbWaitingTime?: number | null;
  frightCost?: number | null;
  unloadingCharge?: number | null;
  detentionCharge?: number | null;
  otherExpense?: number | null;
  totalExpense?: number | null;
  profit?: number | null;
}
