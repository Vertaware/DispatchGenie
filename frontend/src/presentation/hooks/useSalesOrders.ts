import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { PaginatedResult } from "~/domain/entities/pagination";
import type { SalesOrder } from "~/domain/entities/sales-order";
import {
  listSalesOrders,
  type ListSalesOrdersParams,
} from "~/infrastructure/services/sales-order.service";

export const salesOrderQueryKeys = {
  all: ["sales-orders"] as const,
  lists: () => [...salesOrderQueryKeys.all, "list"] as const,
  list: (params: ListSalesOrdersParams) => [...salesOrderQueryKeys.lists(), params],
  detail: (id: string) => [...salesOrderQueryKeys.all, "detail", id],
};

export function useSalesOrders(params: ListSalesOrdersParams) {
  return useQuery<PaginatedResult<SalesOrder>>({
    queryKey: salesOrderQueryKeys.list(params),
    queryFn: () => listSalesOrders(params),
    placeholderData: keepPreviousData,
  });
}
