import type { PaginatedResult } from "~/domain/entities/pagination";
import api from "../configs/axios.config";

export interface BankTransaction {
  id: string;
  tenantId: string;
  transactionCode: string;
  transactionDate?: string | null;
  beneficiaryId: string;
  totalPaidAmount: number;
  paymentDocumentId: string;
  createdAt: string;
  updatedAt: string;
  beneficiary?: {
    id: string;
    name: string;
    accountNumber: string;
    bankNameAndBranch: string;
  };
}

export interface BankTransactionWithDetails extends BankTransaction {
  beneficiary?: {
    id: string;
    name: string;
    accountNumber: string;
    bankNameAndBranch: string;
    ifscCode?: string;
    contactInfo?: string;
  };
  allocations?: Array<{
    id: string;
    allocatedAmount: number;
    paymentRequestId: string;
    bankTransactionId: string;
    createdAt: string;
    paymentRequest: {
      id: string;
      salesOrderId: string;
      vehicleId: string;
      transactionType: string;
      requestedAmount: number;
      status: string;
      salesOrder?: {
        id: string;
        soNumber: string;
        soDate: string;
        customerName?: string;
        partyName?: string;
        townName?: string;
        pinCode?: string;
        finalAmount?: number;
      };
      vehicle?: {
        id: string;
        vehicleNumber: string;
        vehicleName?: string;
        driverPhone?: string;
        location?: string;
        truckSize?: string;
        truckType?: string;
      };
    };
  }>;
}

export interface ListBankTransactionsParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  filters?: Record<string, string>;
}

const buildQueryParams = (params: ListBankTransactionsParams = {}) => {
  const query: Record<string, string | number> = {};

  if (params.page) query.page = params.page;
  if (params.pageSize) query.pageSize = params.pageSize;
  if (params.sortBy) query.sortBy = params.sortBy;
  if (params.sortOrder) query.sortOrder = params.sortOrder;

  Object.entries(params.filters ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    query[`filters[${key}]`] = value;
  });

  return query;
};

export async function listBankTransactions(params: ListBankTransactionsParams = {}) {
  const response = await api.get<PaginatedResult<BankTransaction>>("/transactions", {
    params: buildQueryParams(params),
  });
  return response.data;
}

export async function getBankTransaction(id: string) {
  const response = await api.get<BankTransactionWithDetails>(`/transactions/${id}`);
  return response.data;
}

export interface CreateBankTransactionInput {
  transactionCode: string;
  transactionDate: string;
  beneficiaryId: string;
  totalPaidAmount: number;
  paymentProof: File;
}

export async function createBankTransaction(input: CreateBankTransactionInput) {
  const formData = new FormData();
  formData.append("transactionCode", input.transactionCode);
  formData.append("transactionDate", input.transactionDate);
  formData.append("beneficiaryId", input.beneficiaryId);
  formData.append("totalPaidAmount", input.totalPaidAmount.toString());
  formData.append("paymentProof", input.paymentProof);

  const response = await api.post<BankTransaction>("/transactions", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
}

export interface ExportBankTransactionsParams extends ListBankTransactionsParams {
  exportType?: "excel" | "csv";
}

export async function exportBankTransactions(params: ExportBankTransactionsParams = {}) {
  const response = await api.get<Blob>("/transactions/export", {
    params: buildQueryParams(params),
    responseType: "blob",
  });

  const disposition = response.headers["content-disposition"];
  const match = disposition?.match(/filename="?([^"]+)"?/i);
  const fileName = match?.[1] ?? `transactions-${new Date().toISOString()}.xlsx`;

  return { blob: response.data, fileName };
}

export interface AvailableBankTransaction extends BankTransaction {
  remainingBalance: number;
}

export async function listAvailableBankTransactions(beneficiaryId?: string) {
  const params: Record<string, string> = {};
  if (beneficiaryId) {
    params.beneficiaryId = beneficiaryId;
  }

  const response = await api.get<AvailableBankTransaction[]>("/transactions/available", {
    params,
  });
  return response.data;
}
