import {
  DocumentType,
  GateStatus,
  InvoiceStatus,
  LoadType,
  PaymentRequestStatus,
  PaymentRequestType,
  SalesOrderStatus,
  TenantSubscriptionStatus,
  TruckType,
  UserRole,
  VehicleInvoiceStatus,
  VehicleStatus,
} from './enums';

export type Identifier = string;

export interface PaginatedResult<T> {
  data: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface TenantDto {
  id: Identifier;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
  stripeCustomerId?: string | null;
  subscriptionStatus: TenantSubscriptionStatus;
  trialEndsAt?: string | null;
  isActive: boolean;
}

export interface UserDto {
  id: Identifier;
  tenantId: Identifier;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string | null;
}

export type SalesOrderFieldSource = Record<string, 'manual' | 'import' | 'image'>;

export interface SalesOrderArticleDto {
  articleId?: string | null;
  articleDescription?: string | null;
  articleQuantity?: number | null;
}

export interface SalesOrderDto {
  id: Identifier;
  tenantId: Identifier;
  soNumber: string;
  soDate: string;
  customerId?: string | null;
  customerName?: string | null;
  partyName?: string | null;
  sku?: string | null;
  articleDescription?: string | null;
  notes?: string | null;
  tripReferenceNo?: number | null;
  soCases?: number | null;
  caseLot?: string | null;
  townName?: string | null;
  pinCode?: string | null;
  quantity?: number | null;
  requestedTruckSize?: string | null;
  requestedTruckType?: TruckType | null;
  category?: string | null;
  partyAddress?: string | null;
  status: SalesOrderStatus;
  previousStatus?: SalesOrderStatus | null;
  finalAmount?: number | null;
  loadingQuantity?: number | null;
  frightCost?: number | null;
  profit?: number | null;
  createdFromImport: boolean;
  fieldSource?: SalesOrderFieldSource | null;
  articles?: SalesOrderArticleDto[] | null;
  createdAt: string;
  updatedAt: string;
  vehicles?: VehicleDto[];
  placedTruckSize?: string | null;
  placedTruckType?: TruckType | null;
  loadType?: LoadType | null;
}

export interface VehicleDto {
  id: Identifier;
  tenantId: Identifier;
  vehicleNumber: string;
  driverName?: string | null;
  driverPhoneNumber?: string | null;
  asmPhoneNumber?: string | null;
  placedTruckSize?: string | null;
  placedTruckType?: TruckType | null;
  vehicleName?: string | null;
  driverPhone?: string | null;
  truckSize?: string | null;
  truckType?: TruckType | null;
  loadType?: LoadType | null;
  vehicleAmount?: number | null;
  vehicleExpense?: number | null;
  shippingAmount?: number | null;
  shippingExpense?: number | null;
  location?: string | null;
  locationReachedAt?: string | null;
  unloadedAt?: string | null;
  unloadedTime?: string | null;
  billedOn?: string | null;
  filledOn?: string | null;
  dbWaitingTimeHours?: number | null;
  loadingQuantity?: number | null;
  checkInAt?: string | null;
  gateInAt?: string | null;
  gateOutAt?: string | null;
  loadingStartedAt?: string | null;
  loadingCompletedAt?: string | null;
  status: VehicleStatus;
  invoiceStatus: VehicleInvoiceStatus;
  isPaid: boolean;
  profit?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface BeneficiaryDto {
  id: Identifier;
  tenantId: Identifier;
  name: string;
  accountNumber: string;
  bankNameAndBranch: string;
  ifscCode: string;
  contactInfo?: string | null;
  documentId?: Identifier | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRequestDto {
  id: Identifier;
  tenantId: Identifier;
  salesOrderId: Identifier;
  soNumber?: string;
  vehicleId: Identifier;
  transactionType: PaymentRequestType;
  paymentDate?: string | null;
  requestedAmount: number;
  beneficiaryId: Identifier;
  status: PaymentRequestStatus;
  hasUnloadingCharge: boolean;
   notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BankTransactionDto {
  id: Identifier;
  tenantId: Identifier;
  transactionCode: string;
  transactionDate?: string | null;
  beneficiaryId: Identifier;
  totalPaidAmount: number;
  paymentDocumentId: Identifier;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentAllocationDto {
  id: Identifier;
  tenantId: Identifier;
  paymentRequestId: Identifier;
  bankTransactionId: Identifier;
  allocatedAmount: number;
  createdAt: string;
}

export interface InvoiceDto {
  id: Identifier;
  tenantId: Identifier;
  invoiceNumber: string;
  date: string;
  invoiceAmount: number;
  status: InvoiceStatus;
  paidDate?: string | null;
  paidAmount?: number | null;
  invoiceDocumentId?: Identifier | null;
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

export interface DocumentDto {
  id: Identifier;
  tenantId: Identifier;
  type: DocumentType;
  fileName: string;
  mimeType: string;
  storagePath?: string; // Deprecated: kept for backward compatibility
  viewerUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface GateDto {
  id: Identifier;
  tenantId: Identifier;
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
  vehicle?: VehicleDto | null;
  // Sales order details (if linked)
  salesOrder?: SalesOrderDto | null;
}

export interface AuthenticatedUser {
  userId: Identifier;
  tenantId: Identifier;
  email: string;
  role: UserRole;
}

export interface ApiError {
  message: string;
  code: string;
  details?: unknown;
}
