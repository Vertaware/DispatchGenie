"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircularProgress, Dialog, MenuItem, TextField } from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { IoClose } from "react-icons/io5";
import { FormDate, FormInput, FormNumber } from "~/components/form";
import {
  transactionRecordSchema,
  type TransactionRecordForm,
} from "~/domain/schemas/transaction.schema";
import { Beneficiary, listBeneficiaries } from "~/infrastructure/services/beneficiary.service";
import { createBankTransaction } from "~/infrastructure/services/transaction.service";
import { useSnackbar } from "~/shared/contexts";

type TransactionsRecordModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function TransactionsRecordModal({ open, onClose }: TransactionsRecordModalProps) {
  const queryClient = useQueryClient();
  const { showSnackbar } = useSnackbar();
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [beneficiariesLoading, setBeneficiariesLoading] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TransactionRecordForm>({
    mode: "onChange",
    resolver: zodResolver(transactionRecordSchema),
    defaultValues: {
      transactionCode: "",
      transactionDate: "",
      totalPaidAmount: "",
      beneficiaryId: "",
      paymentProof: undefined,
    },
  });

  const paymentProof = watch("paymentProof");

  const handleClose = () => {
    if (createTransactionMutation.isPending) return;
    reset();
    setBeneficiaries([]);
    onClose();
  };

  const createTransactionMutation = useMutation({
    mutationFn: async (data: TransactionRecordForm) => {
      return createBankTransaction({
        transactionCode: data.transactionCode,
        transactionDate: data.transactionDate,
        beneficiaryId: data.beneficiaryId,
        totalPaidAmount: Number(data.totalPaidAmount),
        paymentProof: data.paymentProof,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      showSnackbar({
        message: "Transaction created successfully",
        severity: "success",
      });
      reset();
      setBeneficiaries([]);
      onClose();
    },
    onError: (error: unknown) => {
      const message =
        (error as any)?.response?.data?.message ||
        (error instanceof Error ? error.message : "Failed to create transaction");
      showSnackbar({
        message,
        severity: "error",
      });
    },
  });

  useEffect(() => {
    if (open) {
      loadBeneficiaries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const loadBeneficiaries = async () => {
    setBeneficiariesLoading(true);
    try {
      const result = await listBeneficiaries({ pageSize: 1000 });
      setBeneficiaries(result.data);
    } catch {
      showSnackbar({
        message: "Failed to load beneficiaries",
        severity: "error",
      });
    } finally {
      setBeneficiariesLoading(false);
    }
  };

  const handlePaymentProofChange = (file?: File) => {
    setValue("paymentProof", file ?? (null as unknown as File), { shouldValidate: true });
  };

  const handleRemoveFile = () => {
    setValue("paymentProof", null as unknown as File, { shouldValidate: true });
  };

  const handleDownloadFile = () => {
    if (paymentProof) {
      const url = URL.createObjectURL(paymentProof);
      const a = document.createElement("a");
      a.href = url;
      a.download = paymentProof.name;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const onSubmit = async (data: TransactionRecordForm) => {
    await createTransactionMutation.mutateAsync(data);
  };

  return (
    <Dialog
      open={open}
      onClose={(event, reason) => {
        if (reason !== "backdropClick") {
          handleClose();
        }
      }}
      classes={{
        paper: "!rounded-md",
      }}
      disableEscapeKeyDown
    >
      {/* Header */}
      <div className="relative flex flex-col gap-1 p-6">
        <h2 className="text-2xl font-bold text-[#1a1a1a]">Add New Transactions</h2>
        <p className="text-sm font-normal text-[#6B7280]">
          Your transactions to update your records
        </p>
        <button
          onClick={handleClose}
          className="absolute right-4 top-6 cursor-pointer rounded p-1 text-[#ef4444] transition-colors hover:bg-red-50 disabled:opacity-60"
          aria-label="close"
          disabled={createTransactionMutation.isPending}
        >
          <IoClose className="text-xl" />
        </button>
      </div>
      {/* Content */}
      <form className="px-6" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="flex flex-col gap-4">
          {/* Transaction ID */}
          <FormInput
            label="Transaction ID"
            name="transactionCode"
            control={control}
            error={!!errors.transactionCode}
            helperText={errors.transactionCode?.message}
            required
          />
          <FormDate
            label="Transaction Date"
            name="transactionDate"
            control={control}
            error={!!errors.transactionDate}
            helperText={errors.transactionDate?.message}
            required
          />
          <FormNumber
            label="Total Amount"
            name="totalPaidAmount"
            control={control}
            error={!!errors.totalPaidAmount}
            helperText={errors.totalPaidAmount?.message}
            required
          />
          {/* Beneficiary Name */}
          <Controller
            name="beneficiaryId"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                select
                label="Beneficiary Name"
                required
                fullWidth
                value={field.value}
                disabled={beneficiariesLoading || createTransactionMutation.isPending}
                error={!!errors.beneficiaryId}
                helperText={errors.beneficiaryId?.message}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    backgroundColor: "#f9fafb",
                    borderRadius: 1,
                  },
                }}
              >
                {beneficiariesLoading ? (
                  <MenuItem value="">
                    <CircularProgress size={20} />
                  </MenuItem>
                ) : beneficiaries.length === 0 ? (
                  <MenuItem value="" disabled>
                    No beneficiaries found
                  </MenuItem>
                ) : (
                  beneficiaries.map((beneficiary) => (
                    <MenuItem key={beneficiary.id} value={beneficiary.id}>
                      {beneficiary.name}
                    </MenuItem>
                  ))
                )}
              </TextField>
            )}
          />
          {/* Payment Document */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-[#1a1a1a]">
              Payment Document (PDF/Image) <span className="text-red-500">*</span>
            </label>
            {paymentProof ? (
              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-2">
                <span className="truncate text-sm text-gray-700">{paymentProof.name}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    disabled={createTransactionMutation.isPending}
                    className="rounded p-1 text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50"
                  >
                    <IoClose className="text-lg" />
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadFile}
                    disabled={createTransactionMutation.isPending}
                    className="rounded p-1 text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="size-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  handlePaymentProofChange(file ?? undefined);
                }}
                className="w-full rounded border border-[#d1d5db] px-3 py-2 text-sm text-[#1a1a1a] focus:border-[#6C63FF] focus:outline-none"
                disabled={createTransactionMutation.isPending}
              />
            )}
            {errors.paymentProof?.message && (
              <span className="text-xs text-red-500">{errors.paymentProof.message}</span>
            )}
          </div>
          {/* Actions */}
          <div className="flex items-center justify-center gap-4 p-6">
            <button
              type="button"
              onClick={handleClose}
              className="min-w-[120px] rounded-lg border border-[#d1d5db] px-4 py-2 text-[#1a1a1a] transition-colors hover:border-[#9ca3af] hover:bg-[#f9fafb] disabled:opacity-60"
              disabled={createTransactionMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex min-w-[120px] cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#6C63FF] px-4 py-2 text-white transition-colors hover:bg-[#5a52e6] disabled:opacity-60"
              disabled={createTransactionMutation.isPending}
            >
              {createTransactionMutation.isPending ? "Loading..." : "Save"}
            </button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
