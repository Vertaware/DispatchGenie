import type { Invoice } from "~/domain/entities/invoice";
import type { PaginatedResult } from "~/domain/entities/pagination";
import api from "../configs/axios.config";

export interface ListInvoicesParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  filters?: Record<string, string | string[]>;
}

const buildQueryParams = (params: ListInvoicesParams = {}) => {
  const query: Record<string, string | number> = {};

  if (params.page) query.page = params.page;
  if (params.pageSize) query.pageSize = params.pageSize;
  if (params.sortBy) query.sortBy = params.sortBy;
  if (params.sortOrder) query.sortOrder = params.sortOrder;

  Object.entries(params.filters ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value)) {
      query[`filters[${key}]`] = value.join(",");
    } else {
      query[`filters[${key}]`] = value;
    }
  });

  return query;
};

export async function listInvoices(params: ListInvoicesParams = {}) {
  const response = await api.get<PaginatedResult<Invoice>>("/invoices", {
    params: buildQueryParams(params),
  });
  return response.data;
}

export interface CreateInvoiceInput {
  invoiceNumber: string;
  date: string;
  vehicleIds: string[];
  overrideInvoiceAmount?: number;
  invoicePdf?: File;
}

export async function createInvoice(payload: CreateInvoiceInput) {
  const formData = new FormData();
  formData.append("invoiceNumber", payload.invoiceNumber);
  formData.append("date", payload.date);
  payload.vehicleIds.forEach((id) => {
    formData.append("vehicleIds", id);
  });
  if (payload.overrideInvoiceAmount !== undefined) {
    formData.append("overrideInvoiceAmount", payload.overrideInvoiceAmount.toString());
  }
  if (payload.invoicePdf) {
    formData.append("invoicePdf", payload.invoicePdf);
  }

  const response = await api.post<Invoice>("/invoices", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export interface InvoiceDetail {
  id: string;
  tenantId: string;
  invoiceNumber: string;
  date: string;
  invoiceAmount: number;
  status: string;
  paidDate?: string | null;
  paidAmount?: number | null;
  invoiceDocumentId?: string | null;
  totalProfit?: number | null;
  createdAt: string;
  updatedAt: string;
  vehicles: Array<{
    id: string;
    vehicle: any;
  }>;
}

export async function getInvoice(id: string) {
  const response = await api.get<InvoiceDetail>(`/invoices/${id}`);
  return response.data;
}

export interface MarkInvoicePaidInput {
  paidAmount: number;
  paidDate: string;
}

export async function markInvoicePaid(id: string, payload: MarkInvoicePaidInput) {
  const response = await api.post<Invoice>(`/invoices/${id}/mark-paid`, payload);
  return response.data;
}

export interface ExportInvoicesParams extends ListInvoicesParams {
  exportType?: "excel" | "csv";
}

export async function exportInvoices(params: ExportInvoicesParams = {}) {
  const response = await api.get<Blob>("/invoices/export", {
    params: buildQueryParams(params),
    responseType: "blob",
  });

  const disposition = response.headers["content-disposition"];
  const match = disposition?.match(/filename="?([^"]+)"?/i);
  const fileName = match?.[1] ?? `invoices-${new Date().toISOString()}.xlsx`;

  return { blob: response.data, fileName };
}
