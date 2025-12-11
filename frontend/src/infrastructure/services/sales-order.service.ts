import type { PaginatedResult } from "~/domain/entities/pagination";
import type { SalesOrder } from "~/domain/entities/sales-order";
import api from "../configs/axios.config";

export type SortOrder = "asc" | "desc";

export interface SalesOrderFilters {
  status?: string | string[];
  fromDate?: string;
  toDate?: string;
  search?: string;
  [key: string]: string | number | string[] | undefined;
}

export interface ListSalesOrdersParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: SortOrder;
  filters?: SalesOrderFilters;
}

import type { SalesOrderArticle } from "~/domain/entities/sales-order";

export interface CreateSalesOrderInput {
  soNumber: string;
  soDate: string;
  articleDescription?: string | null;
  soCases?: string | null;
  caseLot?: string | null;
  townName?: string | null;
  pinCode?: string | null;
  partyAddress?: string | null;
  requestedTruckSize?: string | null;
  requestedTruckType?: string | null;
  placedTruckSize?: string | null;
  placedTruckType?: string | null;
  articles?: SalesOrderArticle[] | null;
}

export type UpdateSalesOrderInput = Partial<Omit<CreateSalesOrderInput, "soNumber" | "soDate">> & {
  soDate?: string;
  status?: string;
};

const buildQueryParams = (params: ListSalesOrdersParams = {}) => {
  const query: Record<string, string | number> = {};

  if (params.page) query.page = params.page;
  if (params.pageSize) query.pageSize = params.pageSize;
  if (params.sortBy) query.sortBy = params.sortBy;
  if (params.sortOrder) query.sortOrder = params.sortOrder;

  Object.entries(params.filters ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    if (Array.isArray(value)) {
      query[`filters[${key}]`] = value.join(",");
    } else {
      query[`filters[${key}]`] = value as string | number;
    }
  });

  return query;
};

export async function listSalesOrders(params: ListSalesOrdersParams = {}) {
  const response = await api.get<PaginatedResult<SalesOrder>>("/sales-orders", {
    params: buildQueryParams(params),
  });
  return response.data;
}

export async function getSalesOrder(id: string) {
  const response = await api.get<SalesOrder>(`/sales-orders/${id}`);
  return response.data;
}

export async function getSalesOrderByNumber(soNumber: string) {
  const response = await api.get<SalesOrder>(`/sales-orders/by-number/${soNumber}`);
  return response.data;
}

export async function searchSalesOrders(searchTerm: string, excludeWithPayments: boolean = true) {
  const response = await api.get<SalesOrder[]>("/sales-orders/search", {
    params: {
      q: searchTerm,
      excludeWithPayments: excludeWithPayments.toString(),
    },
  });
  return response.data;
}

export async function createSalesOrder(payload: CreateSalesOrderInput) {
  const response = await api.post<SalesOrder>("/sales-orders", payload);
  return response.data;
}

export async function updateSalesOrder(id: string, payload: UpdateSalesOrderInput) {
  const response = await api.patch<SalesOrder>(`/sales-orders/${id}`, payload);
  return response.data;
}

export async function holdSalesOrder(id: string) {
  const response = await api.patch<SalesOrder>(`/sales-orders/${id}/hold`);
  return response.data;
}

export async function deleteSalesOrder(id: string) {
  const response = await api.patch<SalesOrder>(`/sales-orders/${id}/delete`);
  return response.data;
}

export async function reactivateSalesOrder(id: string) {
  const response = await api.patch<SalesOrder>(`/sales-orders/${id}/reactivate`);
  return response.data;
}

export type ExportSalesOrdersParams = ListSalesOrdersParams;

export async function exportSalesOrders(params: ExportSalesOrdersParams = {}) {
  const response = await api.get<Blob>("/sales-orders/export", {
    params: buildQueryParams(params),
    responseType: "blob",
  });

  const disposition = response.headers["content-disposition"];
  const match = disposition?.match(/filename="?([^"]+)"?/i);
  const fileName = match?.[1] ?? `sales-orders-${new Date().toISOString()}.xlsx`;

  return { blob: response.data, fileName };
}

export async function importSalesOrders(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post<{
    created: number;
    updated: number;
    errors: string[];
  }>("/sales-orders/import", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data;
}
