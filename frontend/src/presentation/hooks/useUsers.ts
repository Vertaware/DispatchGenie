import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { PaginatedResult } from "~/domain/entities/pagination";
import type { User } from "~/domain/entities/user";
import { listUsers, type ListUsersParams } from "~/infrastructure/services/user.service";

export const userQueryKeys = {
  all: ["users"] as const,
  lists: () => [...userQueryKeys.all, "list"] as const,
  list: (params: ListUsersParams) => [...userQueryKeys.lists(), params],
  detail: (id: string) => [...userQueryKeys.all, "detail", id],
};

export function useUsers(params: ListUsersParams) {
  return useQuery<PaginatedResult<User>>({
    queryKey: userQueryKeys.list(params),
    queryFn: () => listUsers(params),
    placeholderData: keepPreviousData,
  });
}
