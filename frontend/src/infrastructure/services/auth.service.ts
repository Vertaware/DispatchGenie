import type { AuthUser } from "~/domain/entities/auth";
import api from "../configs/axios.config";

export interface RequestOtpProps {
  tenantSlug: string;
  email: string;
}

export interface VerifyOtpProps extends RequestOtpProps {
  code: string;
}

export interface VerifyOtpResponse {
  token: string;
  user: AuthUser;
}

async function requestOtp(props: RequestOtpProps) {
  await api.post("/auth/request-otp", props);
}

async function verifyOtp(props: VerifyOtpProps): Promise<VerifyOtpResponse> {
  const response = await api.post<VerifyOtpResponse>("/auth/verify-otp", props);
  return response.data;
}

export { requestOtp, verifyOtp };
