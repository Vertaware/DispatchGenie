"use client";

import { useState } from "react";
import LoginForm from "./login-form";
import OtpForm from "./otp-form";

export type LoginData = {
  tenantSlug: string;
  email: string;
  isOtpSent: boolean;
};

export default function LoginPage() {
  const [formData, setFormData] = useState<LoginData>({
    tenantSlug: "",
    email: "",
    isOtpSent: false,
  });

  const handleOtpSent = (data: LoginData) => {
    setFormData(data);
  };

  const resetOtpSent = () => {
    setFormData({ tenantSlug: "", email: "", isOtpSent: false });
  };

  return (
    <div className="flex h-screen flex-col items-center justify-center">
      {!formData.isOtpSent ? (
        <LoginForm handleOtpSent={handleOtpSent} />
      ) : (
        <OtpForm formData={formData} resetOtpSent={resetOtpSent} />
      )}
    </div>
  );
}
