import type { PaginatedResult } from "~/domain/entities/pagination";
import api from "../configs/axios.config";

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

export interface ListBeneficiariesParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  filters?: Record<string, string>;
}

const buildQueryParams = (params: ListBeneficiariesParams = {}) => {
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

export async function listBeneficiaries(params: ListBeneficiariesParams = {}) {
  const response = await api.get<PaginatedResult<Beneficiary>>("/beneficiaries", {
    params: buildQueryParams(params),
  });
  return response.data;
}

export async function getBeneficiary(id: string) {
  const response = await api.get<Beneficiary>(`/beneficiaries/${id}`);
  return response.data;
}

export interface CreateBeneficiaryInput {
  name: string;
  accountNumber: string;
  bankNameAndBranch: string;
  ifscCode: string;
  contactInfo?: string;
  document?: File;
}

export async function createBeneficiary(input: CreateBeneficiaryInput) {
  let documentId: string | undefined;

  // Upload document if provided
  if (input.document) {
    const formData = new FormData();
    formData.append("file", input.document);
    formData.append("type", "BENEFICIARY_DOC");

    const docResponse = await api.post<{ id: string }>("/documents", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    documentId = docResponse.data.id;
  }

  // Create beneficiary
  const response = await api.post<Beneficiary>("/beneficiaries", {
    name: input.name,
    accountNumber: input.accountNumber,
    bankNameAndBranch: input.bankNameAndBranch,
    ifscCode: input.ifscCode,
    contactInfo: input.contactInfo || null,
    documentId: documentId || null,
  });
  return response.data;
}

export interface UpdateBeneficiaryInput {
  name?: string;
  bankNameAndBranch?: string;
  ifscCode?: string;
  contactInfo?: string;
  document?: File;
}

export async function updateBeneficiary(id: string, input: UpdateBeneficiaryInput) {
  let documentId: string | undefined;

  // Upload document if provided
  if (input.document) {
    const formData = new FormData();
    formData.append("file", input.document);
    formData.append("type", "BENEFICIARY_DOC");

    const docResponse = await api.post<{ id: string }>("/documents", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    documentId = docResponse.data.id;
  }

  // Update beneficiary
  const updateData: any = { ...input };
  delete updateData.document;
  if (documentId) {
    updateData.documentId = documentId;
  }

  const response = await api.patch<Beneficiary>(`/beneficiaries/${id}`, updateData);
  return response.data;
}

export interface ExportBeneficiariesParams extends ListBeneficiariesParams {
  format?: "xlsx" | "csv" | "pdf";
}

export async function exportBeneficiaries(params: ExportBeneficiariesParams = { format: "pdf" }) {
  const response = await api.get<Blob>("/beneficiaries/export", {
    params: buildQueryParams(params),
    responseType: "blob",
  });

  const disposition = response.headers["content-disposition"];
  const match = disposition?.match(/filename="?([^"]+)"?/i);
  const fileName = match?.[1] ?? `beneficiaries-${new Date().toISOString()}.xlsx`;

  return { blob: response.data, fileName };
}
