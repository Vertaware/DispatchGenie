import { useQuery } from "@tanstack/react-query";
import type { PaginatedResult } from "~/domain/entities/pagination";
import type { Vehicle } from "~/domain/entities/vehicle";
import { listVehicles, type ListVehiclesParams } from "~/infrastructure/services/vehicle.service";

export const vehicleQueryKeys = {
  all: ["vehicles"] as const,
  lists: () => [...vehicleQueryKeys.all, "list"] as const,
  list: (params: ListVehiclesParams) => [...vehicleQueryKeys.lists(), params],
  detail: (id: string) => [...vehicleQueryKeys.all, "detail", id],
};

export function useVehicles(params: ListVehiclesParams) {
  return useQuery<PaginatedResult<Vehicle>>({
    queryKey: vehicleQueryKeys.list(params),
    queryFn: () => listVehicles(params),
  });
}
