import type { SalesOrder } from "./sales-order";
import type { Vehicle } from "./vehicle";

export type PaymentRequestType =
  | "ADVANCE_SHIPPING"
  | "BALANCE_SHIPPING"
  | "FULL_SHIPPING_CHARGES"
  | "POINT_1_TO_POINT_2_TRANSFER"
  | "UNLOADING_CHARGE"
  | "UNLOADING_DETENTION"
  | "MISCELLANEOUS_CHARGES";
export type PaymentRequestStatus = "PENDING" | "COMPLETED";

export interface PaymentRequest {
  id: string;
  tenantId: string;
  salesOrderId: string;
  soNumber?: string;
  vehicleId: string;
  paymentDate?: string | null;
  transactionType: PaymentRequestType;
  requestedAmount: number;
  beneficiaryId: string;
  status: PaymentRequestStatus;
  hasUnloadingCharge: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentAllocation {
  id: string;
  tenantId: string;
  paymentRequestId: string;
  bankTransactionId: string;
  allocatedAmount: number;
  createdAt: string;
}

export interface BankTransaction {
  id: string;
  tenantId: string;
  transactionCode: string;
  beneficiaryId: string;
  totalPaidAmount: number;
  paymentDocumentId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Beneficiary {
  id: string;
  tenantId: string;
  name: string;
  accountNumber: string;
  bankNameAndBranch: string;
  ifscCode: string;
  contactInfo?: string | null;
  documentId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRequestDetail {
  paymentRequest: PaymentRequest;
  allocations: PaymentAllocation[];
  vehicle: Vehicle | null;
  salesOrder: SalesOrder | null;
  bankTransactions: BankTransaction[];
  beneficiary?: Beneficiary | null;
}
