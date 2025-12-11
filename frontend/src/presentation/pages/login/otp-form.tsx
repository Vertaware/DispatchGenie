import { zodResolver } from "@hookform/resolvers/zod";
import { Button, CircularProgress } from "@mui/material";
import { useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { FormOtp } from "~/components/form";
import { VerifyOtpFormData, verifyOtpFormSchema } from "~/domain/schemas/login.schema";
import useAuth from "~/hooks/useAuth";
import { verifyOtp } from "~/infrastructure/services";
import { useSnackbar } from "~/shared/contexts";
import { LoginData } from "./login-page";

interface OtpFormProps {
  formData: LoginData;
  resetOtpSent: () => void;
}

export default function OtpForm({ formData, resetOtpSent }: OtpFormProps) {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");
  const { showSnackbar } = useSnackbar();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<VerifyOtpFormData>({
    resolver: zodResolver(verifyOtpFormSchema),
    defaultValues: {
      code: "",
    },
    mode: "onChange",
  });

  const verifyOtpMutation = useMutation({
    mutationFn: ({ code }: VerifyOtpFormData) =>
      verifyOtp({
        tenantSlug: formData.tenantSlug,
        email: formData.email,
        code,
      }),
  });

  const onSubmit = async (data: VerifyOtpFormData) => {
    try {
      const { token, user } = await verifyOtpMutation.mutateAsync(data);
      await login({
        token,
        tenantSlug: formData.tenantSlug,
        user,
      });
      showSnackbar({ message: "Welcome back!", severity: "success" });
      router.replace(callbackUrl ?? "/sales-orders");
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
    }
  };

  return (
    <div className="max-w-lg space-y-4 rounded-lg bg-white p-6 shadow-md">
      <div className="space-y-2">
        <h1 className="text-lg text-gray-900">
          Enter the 6-digit code sent to <span className="font-bold">{formData.email}</span>
        </h1>
      </div>
      <form className="space-y-4 text-center" onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormOtp
          name="code"
          control={control}
          error={!!errors.code}
          helperText={errors.code?.message}
        />
        <div className="flex items-center justify-center gap-4">
          <Button variant="outlined" onClick={resetOtpSent} disabled={verifyOtpMutation.isPending}>
            Back
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            className="!capitalize"
            disabled={verifyOtpMutation.isPending}
          >
            {verifyOtpMutation.isPending ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              "Verify & Sign In"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
