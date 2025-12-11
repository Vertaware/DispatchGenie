"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircularProgress, Dialog } from "@mui/material";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { IoClose } from "react-icons/io5";
import { FormDate, FormNumber } from "~/components/form";
import type { Invoice } from "~/domain/entities/invoice";
import {
  MarkInvoicePaidFormData,
  markInvoicePaidSchema,
} from "~/domain/schemas/mark-invoice-paid.schema";
import { formatCurrency } from "~/shared/utils/format";

interface MarkInvoicePaidModalProps {
  open: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onSubmit: (data: MarkInvoicePaidFormData) => Promise<void>;
  isLoading?: boolean;
}

export default function MarkInvoicePaidModal({
  open,
  onClose,
  invoice,
  onSubmit,
  isLoading = false,
}: MarkInvoicePaidModalProps) {
  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<MarkInvoicePaidFormData>({
    mode: "onChange",
    resolver: zodResolver(markInvoicePaidSchema),
    defaultValues: {
      paidAmount: invoice?.invoiceAmount ?? 0,
      paidDate: new Date().toISOString().split("T")[0],
    },
  });

  // Update form when invoice changes
  useEffect(() => {
    if (invoice) {
      reset({
        paidAmount: invoice.invoiceAmount,
        paidDate: new Date().toISOString().split("T")[0],
      });
    }
  }, [invoice, reset]);

  const paidAmount = watch("paidAmount");
  const invoiceAmount = invoice?.invoiceAmount ?? 0;

  const handleClose = () => {
    if (isLoading) return;
    reset();
    onClose();
  };

  const onFormSubmit = async (data: MarkInvoicePaidFormData) => {
    await onSubmit(data);
    reset();
  };

  if (!invoice) return null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      classes={{
        paper: "!rounded-md",
      }}
      maxWidth="sm"
      fullWidth
    >
      {/* Header */}
      <div className="relative flex flex-col gap-1 p-6">
        <h2 className="text-2xl font-bold text-[#1a1a1a]">Mark Invoice as Paid</h2>
        <p className="text-sm font-normal text-[#6B7280]">
          Enter the paid amount and date for invoice {invoice.invoiceNumber}
        </p>
        <button
          onClick={handleClose}
          className="absolute right-4 top-6 cursor-pointer rounded p-1 text-[#ef4444] transition-colors hover:bg-red-50 disabled:opacity-60"
          aria-label="close"
          disabled={isLoading}
        >
          <IoClose className="text-xl" />
        </button>
      </div>

      {/* Content */}
      <form className="px-6" onSubmit={handleSubmit(onFormSubmit)} noValidate>
        {/* Invoice Info */}
        <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Invoice Amount:</span>
            <span className="text-sm font-semibold text-gray-900">
              {formatCurrency(invoiceAmount)}
            </span>
          </div>
        </div>

        {/* Form Fields */}
        <div className="flex flex-col gap-4">
          <FormNumber
            label="Paid Amount"
            name="paidAmount"
            control={control}
            error={!!errors.paidAmount}
            helperText={
              errors.paidAmount?.message ||
              (paidAmount !== invoiceAmount
                ? `Invoice amount: ${formatCurrency(invoiceAmount)}`
                : undefined)
            }
            required
          />
          <FormDate
            label="Paid Date"
            name="paidDate"
            control={control}
            error={!!errors.paidDate}
            helperText={errors.paidDate?.message}
            required
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-4 p-6">
          <button
            onClick={handleClose}
            className="min-w-[120px] cursor-pointer rounded-lg border border-[#d1d5db] px-4 py-2 text-[#1a1a1a] transition-colors hover:border-[#9ca3af] hover:bg-[#f9fafb] disabled:opacity-60"
            disabled={isLoading}
            type="button"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex min-w-[120px] cursor-pointer items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white transition-colors hover:bg-green-700 disabled:opacity-60"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <CircularProgress size={18} color="inherit" />
                <span>Marking...</span>
              </>
            ) : (
              "Mark as Paid"
            )}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
