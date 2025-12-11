import type { PaginatedResult } from "~/domain/entities/pagination";
import type {
  PaymentRequest,
  PaymentRequestDetail,
  PaymentRequestStatus,
  PaymentRequestType,
} from "~/domain/entities/payment";
import api from "../configs/axios.config";

export interface ListPaymentRequestsParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  filters?: Partial<{
    status: PaymentRequestStatus | `${PaymentRequestStatus},${PaymentRequestStatus}`;
    transactionType: PaymentRequestType | `${PaymentRequestType},${PaymentRequestType}`;
    vehicleId: string;
    salesOrderId: string;
    beneficiaryId: string;
  }>;
}

const buildQueryParams = (params: ListPaymentRequestsParams = {}) => {
  const query: Record<string, string | number> = {};

  if (params.page) query.page = params.page;
  if (params.pageSize) query.pageSize = params.pageSize;
  if (params.sortBy) query.sortBy = params.sortBy;
  if (params.sortOrder) query.sortOrder = params.sortOrder;

  Object.entries(params.filters ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    query[`filters[${key}]`] = value as string | number;
  });

  return query;
};

export async function listPaymentRequests(params: ListPaymentRequestsParams = {}) {
  const response = await api.get<PaginatedResult<PaymentRequest>>("/payments/requests", {
    params: buildQueryParams(params),
  });
  return response.data;
}

export interface CreatePaymentRequestInput {
  salesOrderId: string;
  vehicleId: string;
  transactionType: PaymentRequestType;
  requestedAmount: number;
  beneficiaryId?: string; // Optional - will be set later
  hasUnloadingCharge?: boolean;
  locationReachedAt?: string;
  unloadedTime?: string;
  notes?: string;
}

export async function createPaymentRequest(payload: CreatePaymentRequestInput) {
  const response = await api.post<PaymentRequest>("/payments/requests", payload);
  return response.data;
}

export async function getPaymentRequest(id: string) {
  const response = await api.get<PaymentRequestDetail>(`/payments/requests/${id}`);
  return response.data;
}

export interface CompletePaymentWithLinkedTransactionsPayload {
  transactionIds: string[];
}

export async function completePaymentWithLinkedTransactions(
  id: string,
  payload: CompletePaymentWithLinkedTransactionsPayload,
) {
  const response = await api.post<PaymentRequest>(
    `/payments/requests/${id}/complete/link-transaction`,
    payload,
  );
  return response.data;
}

export async function exportPaymentRequests(params: ListPaymentRequestsParams = {}) {
  const response = await api.get<Blob>("/payments/requests/export", {
    params: buildQueryParams(params),
    responseType: "blob",
  });
  const disposition = response.headers["content-disposition"];
  // eslint-disable-next-line no-useless-escape
  const match = disposition?.match(/filename=\"?([^\";]+)\"?/i);
  const fileName = match?.[1] ?? `payment-requests-${new Date().toISOString()}.xlsx`;
  return { blob: response.data, fileName };
}

export async function updatePaymentBeneficiary(paymentRequestId: string, beneficiaryId: string) {
  const response = await api.post<PaymentRequest>(
    `/payments/requests/${paymentRequestId}/beneficiary`,
    { beneficiaryId },
  );
  return response.data;
}

export interface EligibleTransaction {
  id: string;
  tenantId: string;
  transactionCode: string;
  beneficiaryId: string;
  totalPaidAmount: number;
  paymentDocumentId: string;
  createdAt: string;
  updatedAt: string;
  remainingBalance: number;
  amountApplied: number;
}

export async function getEligibleTransactions(paymentRequestId: string) {
  const response = await api.get<EligibleTransaction[]>(
    `/payments/requests/${paymentRequestId}/eligible-transactions`,
  );
  return response.data;
}

export interface LinkTransactionsInput {
  allocations: Array<{
    bankTransactionId: string;
    allocatedAmount: number;
  }>;
}

export async function linkTransactionsToPayment(
  paymentRequestId: string,
  payload: LinkTransactionsInput,
) {
  const response = await api.post<{
    paymentRequest: PaymentRequest;
    linkedTransactions: EligibleTransaction[];
  }>(`/payments/requests/${paymentRequestId}/link-transactions`, payload);
  return response.data;
}
