"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircularProgress, Dialog } from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { IoClose } from "react-icons/io5";
import { FormDate, FormInput, FormNumber } from "~/components/form";
import type { Vehicle } from "~/domain/entities/vehicle";
import { CreateInvoiceFormData, createInvoiceSchema } from "~/domain/schemas/invoice.schema";
import { createInvoice, type CreateInvoiceInput } from "~/infrastructure/services/invoice.service";
import { invoiceQueryKeys } from "~/presentation/hooks/useInvoices";
import { vehicleQueryKeys } from "~/presentation/hooks/useVehicles";
import { useSnackbar } from "~/shared/contexts";
import { formatCurrency } from "~/shared/utils/format";

interface CreateInvoiceModalProps {
  open: boolean;
  onClose: () => void;
  selectedVehicles: Vehicle[];
}

interface VehicleSummary {
  vehicle: Vehicle;
  vehicleAmount: number;
  unloadingCharge: number;
  detentionCharge: number;
  frightCost: number;
  total: number;
}

export default function CreateInvoiceModal({
  open,
  onClose,
  selectedVehicles,
}: CreateInvoiceModalProps) {
  const queryClient = useQueryClient();
  const { showSnackbar } = useSnackbar();

  // Calculate summaries for each vehicle
  // Note: For now, we'll use vehicleAmount from the vehicle
  // Unloading charge, detention charge, and freight cost would need to be fetched
  // from payment requests and sales orders via a new API endpoint or by fetching
  // vehicle details individually. For MVP, we'll show vehicle amounts and the backend
  // will calculate the correct totals when creating the invoice.
  const vehicleSummaries: VehicleSummary[] = selectedVehicles.map((vehicle) => {
    const vehicleAmount = vehicle.vehicleAmount ?? 0;
    // TODO: Enhance to fetch actual unloading charge, detention charge, and freight cost
    // These can be calculated from PaymentRequests (UNLOADING_CHARGE, UNLOADING_DETENTION)
    // and SalesOrders (frightCost) associated with each vehicle
    const unloadingCharge = 0;
    const detentionCharge = 0;
    const frightCost = 0;
    const total = vehicleAmount + unloadingCharge + detentionCharge + frightCost;

    return {
      vehicle,
      vehicleAmount,
      unloadingCharge,
      detentionCharge,
      frightCost,
      total,
    };
  });

  // Calculate grand totals
  const grandTotals = vehicleSummaries.reduce(
    (acc, summary) => ({
      vehicleAmount: acc.vehicleAmount + summary.vehicleAmount,
      unloadingCharge: acc.unloadingCharge + summary.unloadingCharge,
      detentionCharge: acc.detentionCharge + summary.detentionCharge,
      frightCost: acc.frightCost + summary.frightCost,
      total: acc.total + summary.total,
    }),
    {
      vehicleAmount: 0,
      unloadingCharge: 0,
      detentionCharge: 0,
      frightCost: 0,
      total: 0,
    },
  );

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<CreateInvoiceFormData>({
    mode: "onChange",
    resolver: zodResolver(createInvoiceSchema),
    defaultValues: {
      invoiceNumber: "",
      date: "",
      vehicleIds: selectedVehicles.map((v) => v.id),
      overrideAmount: undefined,
      invoicePdf: undefined as any,
    },
  });

  // Update vehicleIds when selectedVehicles changes
  useEffect(() => {
    const vehicleIds = selectedVehicles.map((v) => v.id);
    setValue("vehicleIds", vehicleIds, { shouldValidate: true });
  }, [selectedVehicles, setValue]);

  const invoicePdf = watch("invoicePdf");

  const overrideAmount = watch("overrideAmount");

  const createMutation = useMutation({
    mutationFn: (payload: CreateInvoiceInput) => createInvoice(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: vehicleQueryKeys.all });
      showSnackbar({
        message: "Invoice created successfully.",
        severity: "success",
      });
      reset();
      // Clear file input
      const fileInput = document.getElementById("invoicePdfInput") as HTMLInputElement;
      if (fileInput) {
        fileInput.value = "";
      }
      onClose();
    },
    onError: (error: unknown) => {
      const data = (error as any).response?.data?.message;
      const message = data
        ? Array.isArray(data)
          ? data.join(", ")
          : data
        : "Unable to create invoice.";
      showSnackbar({ message, severity: "error" });
    },
  });

  const handleClose = () => {
    if (createMutation.isPending) return;
    reset();
    // Clear file input
    const fileInput = document.getElementById("invoicePdfInput") as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
    onClose();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setValue("invoicePdf", file, { shouldValidate: true });
    }
  };

  const handleRemoveFile = () => {
    setValue("invoicePdf", undefined as any, { shouldValidate: true });
    // Reset the file input
    const fileInput = document.getElementById("invoicePdfInput") as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
  };

  const onSubmit = async (data: CreateInvoiceFormData) => {
    // Always use vehicleIds from selectedVehicles prop to ensure they're current
    const vehicleIds = selectedVehicles.map((v) => v.id);

    if (vehicleIds.length === 0) {
      showSnackbar({
        message: "At least one vehicle must be selected.",
        severity: "error",
      });
      return;
    }

    const payload: CreateInvoiceInput = {
      invoiceNumber: data.invoiceNumber,
      date: data.date,
      vehicleIds,
      overrideInvoiceAmount: data.overrideAmount,
      invoicePdf: data.invoicePdf,
    };
    await createMutation.mutateAsync(payload);
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      classes={{
        paper: "!rounded-md max-w-4xl",
      }}
      maxWidth="lg"
      fullWidth
    >
      {/* Header */}
      <div className="relative flex flex-col gap-1 p-6">
        <h2 className="text-2xl font-bold text-[#1a1a1a]">Create Invoice</h2>
        <p className="text-sm font-normal text-[#6B7280]">
          Review vehicle summary and enter invoice details
        </p>
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
        {/* Vehicle Summary Section */}
        <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Vehicle Summary</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-300">
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">
                    Vehicle Number
                  </th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700">
                    Vehicle Amount
                  </th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700">
                    Unloading Charge
                  </th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700">
                    Detention Charge
                  </th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700">Freight Cost</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700">Total</th>
                </tr>
              </thead>
              <tbody>
                {vehicleSummaries.map((summary) => (
                  <tr key={summary.vehicle.id} className="border-b border-gray-200">
                    <td className="px-3 py-2 text-left text-gray-900">
                      {summary.vehicle.vehicleNumber}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700">
                      {formatCurrency(summary.vehicleAmount)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700">
                      {formatCurrency(summary.unloadingCharge)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700">
                      {formatCurrency(summary.detentionCharge)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700">
                      {formatCurrency(summary.frightCost)}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-gray-900">
                      {formatCurrency(summary.total)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-400 bg-gray-100 font-semibold">
                  <td className="px-3 py-2 text-left text-gray-900">Grand Total</td>
                  <td className="px-3 py-2 text-right text-gray-900">
                    {formatCurrency(grandTotals.vehicleAmount)}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-900">
                    {formatCurrency(grandTotals.unloadingCharge)}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-900">
                    {formatCurrency(grandTotals.detentionCharge)}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-900">
                    {formatCurrency(grandTotals.frightCost)}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-900">
                    {formatCurrency(grandTotals.total)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Form Fields */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <FormInput
              label="Invoice Number"
              name="invoiceNumber"
              control={control}
              error={!!errors.invoiceNumber}
              helperText={errors.invoiceNumber?.message}
              required
            />
            <FormDate
              label="Invoice Date"
              name="date"
              control={control}
              error={!!errors.date}
              helperText={errors.date?.message}
              required
            />
          </div>
          {/* Invoice PDF Upload */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-[#1a1a1a]">
              Invoice PDF <span className="text-red-500">*</span>
            </label>
            {invoicePdf ? (
              <div className="flex items-center gap-2 rounded-md border border-gray-300 bg-gray-50 px-3 py-2">
                <span className="flex-1 text-sm text-gray-700">{invoicePdf.name}</span>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                  disabled={createMutation.isPending}
                >
                  Remove
                </button>
              </div>
            ) : (
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
                <input
                  id="invoicePdfInput"
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  disabled={createMutation.isPending}
                  onChange={handleFileChange}
                />
                <span>Choose PDF File</span>
              </label>
            )}
            {errors.invoicePdf && (
              <span className="text-xs text-red-500">{errors.invoicePdf.message}</span>
            )}
            {invoicePdf && !errors.invoicePdf && (
              <span className="text-xs text-gray-500">
                File size: {(invoicePdf.size / 1024 / 1024).toFixed(2)} MB
              </span>
            )}
          </div>
          <FormNumber
            label="Override Amount (Optional)"
            name="overrideAmount"
            control={control}
            error={!!errors.overrideAmount}
            helperText={
              errors.overrideAmount?.message ||
              (overrideAmount
                ? `Override total from ${formatCurrency(grandTotals.total)} to ${formatCurrency(overrideAmount)}`
                : "Leave empty to use calculated total")
            }
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-4 p-6">
          <button
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
                <span>Creating...</span>
              </>
            ) : (
              "Create Invoice"
            )}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
