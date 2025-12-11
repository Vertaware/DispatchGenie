import { z } from "zod";

export const loginFormSchema = z.object({
  tenantSlug: z.string().min(1, "Tenant slug is required"),
  email: z.string().email("Enter a valid email"),
});

export const verifyOtpFormSchema = z.object({
  code: z.string().min(6, "OTP must be 6 digits"),
});

export type LoginFormData = z.infer<typeof loginFormSchema>;
export type VerifyOtpFormData = z.infer<typeof verifyOtpFormSchema>;
