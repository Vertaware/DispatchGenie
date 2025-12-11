import type { PaginatedResult } from "~/domain/entities/pagination";
import type { User } from "~/domain/entities/user";
import api from "../configs/axios.config";

export interface ListUsersParams {
  page?: number;
  pageSize?: number;
}

const buildQueryParams = (params: ListUsersParams = {}) => {
  const query: Record<string, string | number> = {};

  if (params.page) query.page = params.page;
  if (params.pageSize) query.pageSize = params.pageSize;

  return query;
};

export async function listUsers(params: ListUsersParams = {}) {
  const response = await api.get<PaginatedResult<User>>("/users", {
    params: buildQueryParams(params),
  });
  return response.data;
}

export interface CreateUserInput {
  email: string;
  name: string;
  role: "ADMIN" | "ACCOUNTANT" | "LOGISTIC_WORKER" | "SECURITY";
}

export async function createUser(input: CreateUserInput) {
  const response = await api.post<User>("/users", {
    email: input.email,
    name: input.name,
    role: input.role,
  });
  return response.data;
}
