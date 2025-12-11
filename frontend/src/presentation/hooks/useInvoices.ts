import { useQuery } from "@tanstack/react-query";
import type { Invoice } from "~/domain/entities/invoice";
import type { PaginatedResult } from "~/domain/entities/pagination";
import { listInvoices, type ListInvoicesParams } from "~/infrastructure/services/invoice.service";

export const invoiceQueryKeys = {
  all: ["invoices"] as const,
  lists: () => [...invoiceQueryKeys.all, "list"] as const,
  list: (params: ListInvoicesParams) => [...invoiceQueryKeys.lists(), params],
  detail: (id: string) => [...invoiceQueryKeys.all, "detail", id],
};

export function useInvoices(params: ListInvoicesParams) {
  return useQuery<PaginatedResult<Invoice>>({
    queryKey: invoiceQueryKeys.list(params),
    queryFn: () => listInvoices(params),
  });
}
