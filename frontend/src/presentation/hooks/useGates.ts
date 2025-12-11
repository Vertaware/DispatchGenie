import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { Gate } from "~/domain/entities/gate";
import type { PaginatedResult } from "~/domain/entities/pagination";
import {
  listGateEntries,
  type ListGateEntriesParams,
} from "~/infrastructure/services/gate.service";

export const gateQueryKeys = {
  all: ["gate", "entries"] as const,
  lists: () => [...gateQueryKeys.all, "list"] as const,
  list: (params: ListGateEntriesParams) => [...gateQueryKeys.lists(), params],
  detail: (id: string) => [...gateQueryKeys.all, "detail", id],
};

export function useGates(params: ListGateEntriesParams) {
  return useQuery<PaginatedResult<Gate>>({
    queryKey: gateQueryKeys.list(params),
    queryFn: () => listGateEntries(params),
    placeholderData: keepPreviousData,
  });
}
