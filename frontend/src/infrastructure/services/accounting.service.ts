import api from "../configs/axios.config";

export interface AccountingSearchResult {
  salesOrder: {
    id: string;
    soNumber: string;
    status: string;
    vehicleAmount?: number | null;
    [key: string]: any;
  };
  vehicle: {
    id: string;
    vehicleNumber: string;
    status: string;
    vehicleAmount?: number | null;
    [key: string]: any;
  } | null;
}

export async function searchBySoNumber(soNumber: string) {
  const response = await api.get<AccountingSearchResult[]>("/accounting/search", {
    params: { soNumber },
  });
  return response.data;
}

export async function searchByVehicleNumber(vehicleNumber: string) {
  const response = await api.get<AccountingSearchResult[]>("/accounting/search", {
    params: { vehicleNumber },
  });
  return response.data;
}
