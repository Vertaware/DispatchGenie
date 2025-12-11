"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Autocomplete,
  Checkbox,
  CircularProgress,
  Dialog,
  FormControlLabel,
  MenuItem,
  TextField,
} from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { IoClose } from "react-icons/io5";
import { TRANSACTION_TYPES_OPTIONS } from "~/domain/constants/options";
import type { SalesOrder } from "~/domain/entities/sales-order";
import type { Vehicle } from "~/domain/entities/vehicle";
import { paymentRecordSchema, type PaymentRecordForm } from "~/domain/schemas/payment.schema";
import { Beneficiary, listBeneficiaries } from "~/infrastructure/services/beneficiary.service";
import { createPaymentRequest } from "~/infrastructure/services/payment.service";
import { searchSalesOrders } from "~/infrastructure/services/sales-order.service";
import { uploadVehiclePod } from "~/infrastructure/services/vehicle.service";
import { FormInput, FormNumber, FormSelect } from "~/presentation/components/form";
import { paymentQueryKeys } from "~/presentation/hooks/usePaymentRequests";
import { useSnackbar } from "~/shared/contexts";

type PaymentRecordModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function PaymentRecordModal({ open, onClose }: PaymentRecordModalProps) {
  const queryClient = useQueryClient();
  const { showSnackbar } = useSnackbar();
  const [salesOrderOptions, setSalesOrderOptions] = useState<SalesOrder[]>([]);
  const [selectedSalesOrder, setSelectedSalesOrder] = useState<SalesOrder | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [beneficiariesLoading, setBeneficiariesLoading] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PaymentRecordForm>({
    mode: "onChange",
    resolver: zodResolver(paymentRecordSchema),
    defaultValues: {
      salesOrderId: "",
      vehicleId: "",
      vehicleNumber: "",
      driverName: "",
      driverPhone: "",
      vehicleAmount: 0,
      transactionType: "ADVANCE_SHIPPING",
      transactionAmount: "",
      beneficiaryId: "",
      hasUnloadingCharge: false,
      locationReachedAt: "",
      unloadedTime: "",
      podFile: undefined,
      notes: "",
    },
  });

  const handleClose = () => {
    if (createPaymentMutation.isPending) return;
    setSelectedSalesOrder(null);
    setSalesOrderOptions([]);
    reset();
    onClose();
  };

  const createPaymentMutation = useMutation({
    mutationFn: async (data: PaymentRecordForm) => {
      const needsPod =
        data.transactionType === "BALANCE_SHIPPING" ||
        data.transactionType === "FULL_SHIPPING_CHARGES";

      if (needsPod && data.podFile) {
        await uploadVehiclePod(data.vehicleId, data.podFile);
      }

      // Convert datetime-local format to ISO string for API
      const locationReachedAtISO = data.locationReachedAt
        ? new Date(data.locationReachedAt).toISOString()
        : undefined;
      const unloadedTimeISO = data.unloadedTime
        ? new Date(data.unloadedTime).toISOString()
        : undefined;

      return createPaymentRequest({
        salesOrderId: data.salesOrderId,
        vehicleId: data.vehicleId,
        transactionType: data.transactionType,
        requestedAmount: Number(data.transactionAmount),
        beneficiaryId: data.beneficiaryId,
        hasUnloadingCharge: data.hasUnloadingCharge,
        locationReachedAt: locationReachedAtISO,
        unloadedTime: unloadedTimeISO,
        notes: data.notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentQueryKeys.lists() });
      showSnackbar({
        message: "Payment request created successfully",
        severity: "success",
      });
      reset();
      setSelectedSalesOrder(null);
      setSalesOrderOptions([]);
      onClose();
    },
    onError: (error: unknown) => {
      const message =
        (error as any)?.response?.data?.message ||
        (error instanceof Error ? error.message : "Failed to create payment request");
      showSnackbar({
        message,
        severity: "error",
      });
    },
  });

  const transactionType = watch("transactionType");
  const podFile = watch("podFile");
  const requiresPod =
    transactionType === "BALANCE_SHIPPING" || transactionType === "FULL_SHIPPING_CHARGES";

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

  const handleSalesOrderInputChange = async (value: string) => {
    if (!value || value.length < 2) {
      setSalesOrderOptions([]);
      return;
    }

    setSearchLoading(true);
    try {
      const results = await searchSalesOrders(value, false);
      setSalesOrderOptions(results);
    } catch {
      setSalesOrderOptions([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSalesOrderSelect = (salesOrder: SalesOrder | null) => {
    setSelectedSalesOrder(salesOrder);

    if (!salesOrder) {
      setValue("salesOrderId", "", { shouldValidate: true });
      setValue("vehicleId", "", { shouldValidate: true });
      setValue("vehicleNumber", "", { shouldValidate: true });
      setValue("driverName", "", { shouldValidate: true });
      setValue("driverPhone", "", { shouldValidate: true });
      setValue("vehicleAmount", 0, { shouldValidate: false });
      return;
    }

    const vehicle = (salesOrder as any)?.vehicles?.[0] as Partial<Vehicle> | undefined;
    setValue("salesOrderId", salesOrder.id, { shouldValidate: true });
    setValue("vehicleId", vehicle?.id ?? "", { shouldValidate: true });
    setValue("vehicleNumber", vehicle?.vehicleNumber ?? "", { shouldValidate: true });
    setValue("driverName", vehicle?.driverName ?? "", { shouldValidate: true });
    setValue("driverPhone", vehicle?.driverPhoneNumber ?? "", { shouldValidate: true });
    setValue("vehicleAmount", vehicle?.vehicleAmount ?? 0, { shouldValidate: false });
  };

  const handlePodChange = (file?: File) => {
    setValue("podFile", file, { shouldValidate: true });
  };

  const onSubmit = async (data: PaymentRecordForm) => {
    await createPaymentMutation.mutateAsync(data);
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
        <h2 className="text-2xl font-bold text-[#1a1a1a]">Record Payment</h2>
        <p className="text-sm font-normal text-[#6B7280]">Enter the details for a record payment</p>
        <button
          onClick={handleClose}
          className="absolute right-4 top-6 cursor-pointer rounded p-1 text-[#ef4444] transition-colors hover:bg-red-50 disabled:opacity-60"
          aria-label="close"
          disabled={createPaymentMutation.isPending}
        >
          <IoClose className="text-xl" />
        </button>
      </div>
      {/* Content */}
      <form className="px-6" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="flex flex-col gap-4">
          {/* Sales Order Search */}
          <Controller
            name="salesOrderId"
            control={control}
            render={({ field }) => (
              <Autocomplete
                freeSolo
                options={salesOrderOptions}
                value={selectedSalesOrder}
                getOptionLabel={(option) => (typeof option === "string" ? option : option.soNumber)}
                loading={searchLoading}
                onInputChange={(_, value) => handleSalesOrderInputChange(value)}
                onChange={(_, value) => {
                  if (typeof value === "object") {
                    handleSalesOrderSelect(value);
                    field.onChange(value?.id ?? "");
                  } else {
                    handleSalesOrderSelect(null);
                    field.onChange("");
                  }
                }}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                noOptionsText={
                  !field.value || field.value.length < 2
                    ? "Type at least 2 characters"
                    : "No sales orders found"
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Sales Order"
                    required
                    error={!!errors.salesOrderId}
                    helperText={errors.salesOrderId?.message}
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {searchLoading ? <CircularProgress size={20} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                      sx: {
                        backgroundColor: "#f9fafb",
                        borderRadius: 1,
                      },
                    }}
                  />
                )}
                renderOption={(props, option) => (
                  <li {...props} key={option.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{option.soNumber}</span>
                      <span className="text-sm text-gray-500">
                        {option.customerName || option.partyName || "No customer info"}
                        {option.vehicles &&
                          option.vehicles.length > 0 &&
                          ` • Vehicle: ${option.vehicles[0].vehicleNumber}`}
                      </span>
                    </div>
                  </li>
                )}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    backgroundColor: "#f9fafb",
                    borderRadius: 1,
                  },
                }}
              />
            )}
          />
          <div className="flex items-center justify-between gap-4">
            <FormInput
              label="Vehicle Number"
              name="vehicleNumber"
              control={control}
              error={!!errors.vehicleNumber}
              helperText={errors.vehicleNumber?.message}
              required
              disabled
            />
            <FormInput
              label="Driver Name"
              name="driverName"
              control={control}
              error={!!errors.driverName}
              helperText={errors.driverName?.message}
              required
              disabled
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <FormInput
              label="Driver Phone"
              name="driverPhone"
              control={control}
              error={!!errors.driverPhone}
              helperText={errors.driverPhone?.message}
              required
              disabled
            />
            <FormInput
              label="Vehicle Amount"
              name="vehicleAmount"
              control={control}
              error={!!errors.vehicleAmount}
              helperText={errors.vehicleAmount?.message}
              required
              disabled
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <FormSelect
              control={control}
              name="transactionType"
              label="Transaction Type"
              size="small"
              options={TRANSACTION_TYPES_OPTIONS}
              disabled={createPaymentMutation.isPending}
              error={!!errors.transactionType}
              helperText={errors.transactionType?.message}
            />
            <FormNumber
              label="Transaction Amount"
              name="transactionAmount"
              control={control}
              error={!!errors.transactionAmount}
              helperText={errors.transactionAmount?.message}
              required
            />
          </div>
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
                disabled={beneficiariesLoading}
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
          {/* POD Upload */}
          {requiresPod && (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-[#1a1a1a]">
                POD Document (PDF/Image) <span className="text-red-500">*</span>
              </label>
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  handlePodChange(file ?? undefined);
                }}
                className="w-full rounded border border-[#d1d5db] px-3 py-2 text-sm text-[#1a1a1a] focus:border-[#6C63FF] focus:outline-none"
              />
              {podFile && <span className="text-xs text-[#6B7280]">Selected: {podFile.name}</span>}
              {errors.podFile?.message && (
                <span className="text-xs text-red-500">{errors.podFile.message}</span>
              )}
            </div>
          )}
          {/* Unloading / Detention Toggles */}
          {watch("transactionType") === "UNLOADING_CHARGE" && (
            <Controller
              name="hasUnloadingCharge"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={field.value}
                      onChange={(_, checked) => field.onChange(checked)}
                    />
                  }
                  label="Is Unloading Charge Mentioned"
                />
              )}
            />
          )}
          {watch("transactionType") === "UNLOADING_DETENTION" && (
            <>
              <div className="flex items-center justify-between gap-4">
                <FormInput
                  label="Location Reached At"
                  name="locationReachedAt"
                  type="datetime-local"
                  control={control}
                  error={!!errors.locationReachedAt}
                  helperText={errors.locationReachedAt?.message}
                  required
                  InputLabelProps={{
                    shrink: true,
                  }}
                />
                <FormInput
                  label="Unloaded Time"
                  name="unloadedTime"
                  type="datetime-local"
                  control={control}
                  error={!!errors.unloadedTime}
                  helperText={errors.unloadedTime?.message}
                  required
                  InputLabelProps={{
                    shrink: true,
                  }}
                />
              </div>
            </>
          )}
          {watch("transactionType") === "MISCELLANEOUS_CHARGES" && (
            <FormInput
              label="Notes"
              name="notes"
              control={control}
              error={!!errors.notes}
              helperText={errors.notes?.message}
              required
            />
          )}
          {/* Actions */}
          <div className="flex items-center justify-center gap-4 p-6">
            <button
              type="button"
              onClick={handleClose}
              className="min-w-[120px] rounded-lg border border-[#d1d5db] px-4 py-2 text-[#1a1a1a] transition-colors hover:border-[#9ca3af] hover:bg-[#f9fafb] disabled:opacity-60"
              disabled={createPaymentMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex min-w-[120px] cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#6C63FF] px-4 py-2 text-white transition-colors hover:bg-[#5a52e6] disabled:opacity-60"
              disabled={createPaymentMutation.isPending}
            >
              {createPaymentMutation.isPending ? "Loading..." : "Save"}
            </button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
