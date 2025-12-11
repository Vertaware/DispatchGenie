import { zodResolver } from "@hookform/resolvers/zod";
import { Button, CircularProgress } from "@mui/material";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { FormInput } from "~/components/form";
import { LoginFormData, loginFormSchema } from "~/domain/schemas/login.schema";
import { requestOtp } from "~/infrastructure/services";
import { useSnackbar } from "~/shared/contexts";
import { LoginData } from "./login-page";

interface LoginFormProps {
  handleOtpSent: (data: LoginData) => void;
}

export default function LoginForm({ handleOtpSent }: LoginFormProps) {
  const { showSnackbar } = useSnackbar();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      tenantSlug: "",
      email: "",
    },
    mode: "onChange",
  });

  const requestOtpMutation = useMutation({
    mutationFn: (values: LoginFormData) => requestOtp(values),
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      await requestOtpMutation.mutateAsync(data);
      handleOtpSent({ ...data, isOtpSent: true });
      showSnackbar({ message: "OTP sent to your email.", severity: "success" });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
    }
  };

  return (
    <div className="space-y-4 rounded-lg bg-white p-6 shadow-md">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Sign in to DispatchGenie</h1>
        <p>Enter your details to receive a one-time passcode.</p>
      </div>
      <form className="space-y-4 text-center" onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormInput
          label="Tenant Slug"
          name="tenantSlug"
          control={control}
          error={!!errors.tenantSlug}
          helperText={errors.tenantSlug?.message}
          required
        />
        <FormInput
          label="Work Email"
          name="email"
          control={control}
          error={!!errors.email}
          helperText={errors.email?.message}
          required
        />
        <Button
          type="submit"
          variant="contained"
          color="primary"
          sx={{ textTransform: "capitalize" }}
        >
          {requestOtpMutation.isPending ? (
            <CircularProgress size={24} color="inherit" />
          ) : (
            "Send OTP"
          )}
        </Button>
      </form>
    </div>
  );
}
