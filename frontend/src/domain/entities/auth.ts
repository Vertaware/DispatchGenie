export type UserRole = "ADMIN" | "ACCOUNTANT" | "LOGISTIC_WORKER" | "SECURITY";

export interface AuthUser {
  userId: string;
  tenantId: string;
  email: string;
  role: UserRole;
  name?: string | null;
}
