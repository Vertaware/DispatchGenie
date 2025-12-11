import type { Gate } from "~/domain/entities/gate";
import type { PaginatedResult } from "~/domain/entities/pagination";
import api from "../configs/axios.config";

export interface ListGateEntriesParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  filters?: Record<string, string | string[]>;
}

const buildQueryParams = (params: ListGateEntriesParams = {}) => {
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

export async function listGateEntries(params: ListGateEntriesParams = {}) {
  const response = await api.get<PaginatedResult<Gate>>("/gate", {
    params: buildQueryParams(params),
  });
  return response.data;
}

export async function gateInEntry(gateId: string) {
  const response = await api.post<Gate>(`/gate/${gateId}/gate-in`);
  return response.data;
}

export async function gateOutEntry(gateId: string) {
  const response = await api.post<Gate>(`/gate/${gateId}/gate-out`);
  return response.data;
}

export interface UpdateGateEntryInput {
  notes?: string;
  vehicleNumber?: string;
  [key: string]: any;
}

export async function updateGateEntry(gateId: string, payload: UpdateGateEntryInput) {
  const response = await api.patch<Gate>(`/gate/${gateId}`, payload);
  return response.data;
}

export async function deleteGateEntry(gateId: string) {
  await api.delete(`/gate/${gateId}`);
}

export async function checkInVehicle(vehicleNumber: string) {
  const response = await api.post<Gate>("/gate/check-in", {
    vehicleNumber,
  });
  return response.data;
}
