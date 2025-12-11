"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircularProgress, Dialog } from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { IoClose } from "react-icons/io5";
import { FormInput, FormSelect } from "~/components/form";
import { createUserSchema, type CreateUserFormData } from "~/domain/schemas/user.schema";
import { createUser, type CreateUserInput } from "~/infrastructure/services/user.service";
import { userQueryKeys } from "~/presentation/hooks/useUsers";
import { useSnackbar } from "~/shared/contexts";

interface CreateUserModalProps {
  open: boolean;
  onClose: () => void;
}

export default function CreateUserModal({ open, onClose }: CreateUserModalProps) {
  const queryClient = useQueryClient();
  const { showSnackbar } = useSnackbar();

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateUserFormData>({
    mode: "onChange",
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: "",
      name: "",
      role: "LOGISTIC_WORKER",
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateUserInput) => createUser(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userQueryKeys.all });
      showSnackbar({
        message: "User created successfully.",
        severity: "success",
      });
      reset();
      onClose();
    },
    onError: (error: unknown) => {
      const data = (error as any).response?.data?.message;
      const message = data
        ? Array.isArray(data)
          ? data.join(", ")
          : data
        : "Unable to create user.";
      showSnackbar({ message, severity: "error" });
    },
  });

  const handleClose = () => {
    if (createMutation.isPending) return;
    reset();
    onClose();
  };

  const onSubmit = async (data: CreateUserFormData) => {
    await createMutation.mutateAsync(data);
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      classes={{
        paper: "!rounded-md",
      }}
    >
      {/* Header */}
      <div className="relative flex flex-col gap-1 p-6">
        <h2 className="text-2xl font-bold text-[#1a1a1a]">Create New User</h2>
        <p className="text-sm font-normal text-[#6B7280]">Invite a new user to your tenant</p>
        <button
          onClick={handleClose}
          className="absolute right-4 top-6 cursor-pointer rounded p-1 text-[#ef4444] transition-colors hover:bg-red-50 disabled:opacity-60"
          aria-label="close"
          disabled={createMutation.isPending}
        >
          <IoClose className="text-xl" />
        </button>
      </div>
      {/* Content */}
      <form className="px-6" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="flex flex-col gap-4">
          <FormInput
            label="Email"
            name="email"
            type="email"
            control={control}
            error={!!errors.email}
            helperText={errors.email?.message}
            required
          />
          <FormInput
            label="Name"
            name="name"
            control={control}
            error={!!errors.name}
            helperText={errors.name?.message}
            required
          />
          <FormSelect
            label="Role"
            name="role"
            control={control}
            error={!!errors.role}
            helperText={errors.role?.message}
            size="small"
            options={[
              { value: "ADMIN", label: "Admin" },
              { value: "ACCOUNTANT", label: "Accountant" },
              { value: "LOGISTIC_WORKER", label: "Logistic Worker" },
              { value: "SECURITY", label: "Security" },
            ]}
            required
          />
        </div>
        {/* Actions */}
        <div className="flex items-center justify-center gap-4 p-6">
          <button
            type="button"
            onClick={handleClose}
            className="min-w-[120px] cursor-pointer rounded-lg border border-[#d1d5db] px-4 py-2 text-[#1a1a1a] transition-colors hover:border-[#9ca3af] hover:bg-[#f9fafb] disabled:opacity-60"
            disabled={createMutation.isPending}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex min-w-[120px] cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#6C63FF] px-4 py-2 text-white transition-colors hover:bg-[#5a52e6] disabled:opacity-60"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? (
              <>
                <CircularProgress size={18} color="inherit" />
                <span>Saving...</span>
              </>
            ) : (
              "Create User"
            )}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
