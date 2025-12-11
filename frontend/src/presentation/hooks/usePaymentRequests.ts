import { useQuery } from "@tanstack/react-query";
import type { PaginatedResult } from "~/domain/entities/pagination";
import type { PaymentRequest } from "~/domain/entities/payment";
import {
  listPaymentRequests,
  type ListPaymentRequestsParams,
} from "~/infrastructure/services/payment.service";

export const paymentQueryKeys = {
  all: ["payments", "requests"] as const,
  lists: () => [...paymentQueryKeys.all, "list"] as const,
  list: (params: ListPaymentRequestsParams) => [...paymentQueryKeys.lists(), params],
  detail: (id: string) => [...paymentQueryKeys.all, "detail", id],
};

export function usePaymentRequests(params: ListPaymentRequestsParams) {
  return useQuery<PaginatedResult<PaymentRequest>>({
    queryKey: paymentQueryKeys.list(params),
    queryFn: () => listPaymentRequests(params),
  });
}
