import type { PaginatedResult } from "~/domain/entities/pagination";
import type { SalesOrder } from "~/domain/entities/sales-order";
import type { Vehicle } from "~/domain/entities/vehicle";
import api from "../configs/axios.config";

export type VehicleStatus = Vehicle["status"];

export interface VehicleDocument {
  id: string;
  tenantId: string;
  type: string;
  fileName: string;
  mimeType: string;
  storagePath: string;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleDetail {
  vehicle: Vehicle;
  salesOrders: SalesOrder[];
  documents: VehicleDocument[];
}

export interface ListVehiclesParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  filters?: Record<string, string | string[]>;
}

const buildQueryParams = (params: ListVehiclesParams = {}) => {
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

export async function listVehicles(params: ListVehiclesParams = {}) {
  const response = await api.get<PaginatedResult<Vehicle>>("/vehicles", {
    params: buildQueryParams(params),
  });
  return response.data;
}

export interface AssignVehicleInput {
  salesOrderIds: string[];
  vehicleId?: string;
  vehicleNumber?: string;
  driverName?: string;
  driverPhone?: string;
  driverPhoneNumber?: string;
  placedTruckSize?: string;
  placedTruckType?: string;
  asmPhoneNumber?: string;
  loadType?: string;
  vehicleAmount?: number;
  vehicleExpense?: number;
  location?: string;
}

export interface VehicleAssignmentResult {
  vehicle: Vehicle;
  salesOrders: SalesOrder[];
  documents: unknown[];
}

export async function assignVehicle(payload: AssignVehicleInput) {
  const response = await api.post<VehicleAssignmentResult>("/vehicles/assign", payload);
  return response.data;
}

export interface ExportVehiclesParams extends ListVehiclesParams {
  exportType?: "excel" | "csv";
}

export async function exportVehicles(params: ExportVehiclesParams = {}) {
  const response = await api.get<Blob>("/vehicles/export", {
    params: buildQueryParams(params),
    responseType: "blob",
  });

  const disposition = response.headers["content-disposition"];
  const match = disposition?.match(/filename="?([^"]+)"?/i);
  const fileName = match?.[1] ?? `vehicles-${new Date().toISOString()}.xlsx`;

  return { blob: response.data, fileName };
}

export async function getVehicle(id: string) {
  const response = await api.get<VehicleDetail>(`/vehicles/${id}`);
  return response.data;
}

export interface UpdateVehicleInput {
  vehicleNumber?: string;
  driverName?: string;
  driverPhoneNumber?: string;
  vehicleAmount?: string;
  placedTruckSize?: string;
  placedTruckType?: string;
  asmPhoneNumber?: string;
  status?: string;
  loadingQuantity?: string;
}

export async function updateVehicle(id: string, payload: UpdateVehicleInput) {
  const response = await api.patch<Vehicle>(`/vehicles/${id}`, payload);
  return response.data;
}

export async function uploadVehiclePod(vehicleId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post(`/vehicles/${vehicleId}/pod`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function uploadVehicleInvoicePdf(vehicleId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post(`/vehicles/${vehicleId}/invoice-pdf`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function uploadVehicleLrCopy(vehicleId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post(`/vehicles/${vehicleId}/lr-copy`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export interface SearchVehiclesParams {
  q: string;
}

export async function searchVehicles(params: SearchVehiclesParams) {
  const response = await api.get<Vehicle[]>("/vehicles/search", {
    params: { q: params.q },
  });
  return response.data;
}
