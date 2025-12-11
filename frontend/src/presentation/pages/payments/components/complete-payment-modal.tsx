"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Autocomplete, CircularProgress, Dialog, MenuItem, TextField } from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { IoClose } from "react-icons/io5";
import { TRANSACTION_TYPES_OPTIONS } from "~/domain/constants/options";
import type { PaymentRequestDetail } from "~/domain/entities/payment";
import type { SalesOrder } from "~/domain/entities/sales-order";
import { completePaymentSchema, type CompletePaymentForm } from "~/domain/schemas/payment.schema";
import { listBeneficiaries, type Beneficiary } from "~/infrastructure/services/beneficiary.service";
import {
  completePaymentWithLinkedTransactions,
  getPaymentRequest,
} from "~/infrastructure/services/payment.service";
import { searchSalesOrders } from "~/infrastructure/services/sales-order.service";
import {
  listAvailableBankTransactions,
  type AvailableBankTransaction,
} from "~/infrastructure/services/transaction.service";
import { FormInput, FormNumber, FormSelect } from "~/presentation/components/form";
import { paymentQueryKeys } from "~/presentation/hooks/usePaymentRequests";
import { useSnackbar } from "~/shared/contexts";

type CompletePaymentModalProps = {
  open: boolean;
  onClose: () => void;
  paymentRequestId?: string;
};

export default function CompletePaymentModal({
  open,
  onClose,
  paymentRequestId,
}: CompletePaymentModalProps) {
  const queryClient = useQueryClient();
  const { showSnackbar } = useSnackbar();
  const [paymentDetail, setPaymentDetail] = useState<PaymentRequestDetail | null>(null);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [beneficiariesLoading, setBeneficiariesLoading] = useState(false);
  const [salesOrderOptions, setSalesOrderOptions] = useState<SalesOrder[]>([]);
  const [selectedSalesOrder, setSelectedSalesOrder] = useState<SalesOrder | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [availableTransactions, setAvailableTransactions] = useState<AvailableBankTransaction[]>(
    [],
  );
  const [transactionsLoading, setTransactionsLoading] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CompletePaymentForm>({
    mode: "onChange",
    resolver: zodResolver(completePaymentSchema),
    defaultValues: {
      salesOrderId: "",
      vehicleNumber: "",
      driverName: "",
      driverPhone: "",
      vehicleAmount: "",
      transactionType: "ADVANCE_SHIPPING",
      transactionAmount: "",
      beneficiaryId: "",
      transactionIds: [],
    },
  });

  const transactionIds = watch("transactionIds");
  const beneficiaryId = watch("beneficiaryId");

  // Get selected transactions for validation
  const selectedTransactions = availableTransactions.filter((tx) => transactionIds.includes(tx.id));

  useEffect(() => {
    if (open) {
      loadBeneficiaries();
      if (paymentRequestId) {
        loadPaymentDetails();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, paymentRequestId]);

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

  const loadPaymentDetails = async () => {
    if (!paymentRequestId) return;

    try {
      const detail = await getPaymentRequest(paymentRequestId);
      setPaymentDetail(detail);

      // Set selected sales order if available
      if (detail.salesOrder) {
        setSelectedSalesOrder(detail.salesOrder);
      }

      // Populate form with payment details
      reset({
        salesOrderId: detail.salesOrder?.soNumber || "",
        vehicleNumber: detail.vehicle?.vehicleNumber || "",
        driverName: detail.vehicle?.driverName || "",
        driverPhone: detail.vehicle?.driverPhoneNumber || "",
        vehicleAmount: detail.vehicle?.vehicleAmount?.toString() || "",
        transactionType: detail.paymentRequest.transactionType,
        transactionAmount: detail.paymentRequest.requestedAmount.toString(),
        beneficiaryId: detail.paymentRequest.beneficiaryId || "",
        transactionIds: [],
      });

      // Load transactions for the beneficiary from the record
      if (detail.paymentRequest.beneficiaryId) {
        await loadAvailableTransactions(detail.paymentRequest.beneficiaryId);
      }
    } catch (error) {
      showSnackbar({
        message: error instanceof Error ? error.message : "Failed to load payment details",
        severity: "error",
      });
    }
  };

  const handleSalesOrderInputChange = async (value: string) => {
    if (!value || value.length < 2) {
      setSalesOrderOptions([]);
      return;
    }

    setSearchLoading(true);
    try {
      const results = await searchSalesOrders(value, true);
      setSalesOrderOptions(results);
    } catch {
      setSalesOrderOptions([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSalesOrderSelect = async (salesOrder: SalesOrder | null) => {
    if (!salesOrder) {
      setValue("salesOrderId", "", { shouldValidate: true });
      return;
    }

    try {
      setSelectedSalesOrder(salesOrder);
      setValue("salesOrderId", salesOrder.soNumber, { shouldValidate: true });

      // Populate form with vehicle details if available
      if (salesOrder.vehicles && salesOrder.vehicles.length > 0) {
        const vehicle = salesOrder.vehicles[0];
        setValue("vehicleNumber", vehicle.vehicleNumber || "", { shouldValidate: true });
        setValue("driverName", vehicle.driverName || "", { shouldValidate: true });
        setValue("driverPhone", vehicle.driverPhoneNumber || "", { shouldValidate: true });
        setValue("vehicleAmount", vehicle.vehicleAmount?.toString() || "", {
          shouldValidate: false,
        });
      }
    } catch {
      showSnackbar({
        message: "Failed to load sales order details",
        severity: "error",
      });
    }
  };

  const loadAvailableTransactions = async (beneficiaryId: string) => {
    if (!beneficiaryId) {
      setAvailableTransactions([]);
      return;
    }

    setTransactionsLoading(true);
    try {
      const transactions = await listAvailableBankTransactions(beneficiaryId);
      setAvailableTransactions(transactions);
    } catch {
      showSnackbar({
        message: "Failed to load available transactions",
        severity: "error",
      });
      setAvailableTransactions([]);
    } finally {
      setTransactionsLoading(false);
    }
  };

  // Ensure transactions refresh whenever beneficiary changes
  useEffect(() => {
    if (beneficiaryId) {
      void loadAvailableTransactions(beneficiaryId);
    } else {
      setAvailableTransactions([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beneficiaryId]);

  const handleClose = () => {
    if (completePaymentMutation.isPending) return;
    reset();
    setPaymentDetail(null);
    setBeneficiaries([]);
    setSalesOrderOptions([]);
    setSelectedSalesOrder(null);
    setAvailableTransactions([]);
    onClose();
  };

  const completePaymentMutation = useMutation({
    mutationFn: async (data: CompletePaymentForm) => {
      if (!paymentRequestId) {
        throw new Error("Payment request ID is missing");
      }

      return completePaymentWithLinkedTransactions(paymentRequestId, {
        transactionIds: data.transactionIds,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentQueryKeys.lists() });
      showSnackbar({
        message: "Transactions linked successfully",
        severity: "success",
      });
      handleClose();
    },
    onError: (error: unknown) => {
      const message =
        (error as any)?.response?.data?.message ||
        (error instanceof Error ? error.message : "Failed to link transactions");
      showSnackbar({
        message,
        severity: "error",
      });
    },
  });

  const onSubmit = async (data: CompletePaymentForm) => {
    await completePaymentMutation.mutateAsync(data);
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
        <h2 className="text-2xl font-bold text-[#1a1a1a]">Link Transactions</h2>
        <p className="text-sm font-normal text-[#6B7280]">
          Select one or more existing transactions to link to this payment request
        </p>
        <button
          onClick={handleClose}
          className="absolute right-4 top-6 cursor-pointer rounded p-1 text-[#ef4444] transition-colors hover:bg-red-50 disabled:opacity-60"
          aria-label="close"
          disabled={completePaymentMutation.isPending}
        >
          <IoClose className="text-xl" />
        </button>
      </div>
      {/* Content */}
      <form className="px-6" onSubmit={handleSubmit(onSubmit)} noValidate>
        {!paymentDetail ? (
          <div className="flex justify-center py-8">
            <CircularProgress size={40} />
          </div>
        ) : (
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
                  inputValue={field.value}
                  getOptionLabel={(option) =>
                    typeof option === "string" ? option : option.soNumber
                  }
                  loading={searchLoading}
                  disabled={completePaymentMutation.isPending || !!paymentRequestId}
                  onInputChange={(_, value) => handleSalesOrderInputChange(value)}
                  onChange={(_, value) => {
                    if (typeof value === "object" && value) {
                      handleSalesOrderSelect(value);
                      field.onChange(value.soNumber);
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
            <div className="flex gap-4">
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
            <div className="flex gap-4">
              <FormSelect
                control={control}
                name="transactionType"
                label="Transaction Type"
                size="small"
                options={TRANSACTION_TYPES_OPTIONS}
                disabled
                error={!!errors.transactionType}
                helperText={errors.transactionType?.message}
              />
              <FormNumber
                label="Payment Request Amount"
                name="transactionAmount"
                control={control}
                error={!!errors.transactionAmount}
                helperText={errors.transactionAmount?.message}
                required
                disabled
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
                  disabled
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
            {beneficiaryId && (
              <Controller
                name="transactionIds"
                control={control}
                render={({ field }) => (
                  <TextField
                    select
                    SelectProps={{
                      multiple: true,
                      renderValue: (selected) => {
                        const selectedIds = selected as string[];
                        if (selectedIds.length === 0) {
                          return <span className="text-gray-400">Select transactions</span>;
                        }
                        if (selectedIds.length === 1) {
                          const tx = availableTransactions.find((t) => t.id === selectedIds[0]);
                          return tx ? tx.transactionCode : selectedIds[0];
                        }
                        return `${selectedIds.length} transactions selected`;
                      },
                    }}
                    label="Transactions"
                    required
                    fullWidth
                    value={field.value}
                    onChange={(e) => {
                      const value = e.target.value;
                      const selectedIds = typeof value === "string" ? value.split(",") : value;
                      field.onChange(selectedIds);
                    }}
                    disabled={
                      transactionsLoading || !beneficiaryId || completePaymentMutation.isPending
                    }
                    error={!!errors.transactionIds}
                    helperText={
                      errors.transactionIds?.message ||
                      (transactionsLoading
                        ? "Loading transactions..."
                        : availableTransactions.length === 0
                          ? "No available transactions found for this beneficiary"
                          : selectedTransactions.length > 0
                            ? `Selected: ${selectedTransactions.length} transaction(s), Total: ${selectedTransactions
                                .reduce((sum, tx) => sum + tx.remainingBalance, 0)
                                .toLocaleString()}`
                            : "Select one or more transactions with remaining balance")
                    }
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        backgroundColor: "#f9fafb",
                        borderRadius: 1,
                      },
                    }}
                  >
                    {transactionsLoading ? (
                      <MenuItem value="">
                        <CircularProgress size={20} />
                      </MenuItem>
                    ) : availableTransactions.length === 0 ? (
                      <MenuItem value="" disabled>
                        No available transactions
                      </MenuItem>
                    ) : (
                      availableTransactions.map((transaction) => (
                        <MenuItem key={transaction.id} value={transaction.id}>
                          <div className="flex w-full flex-col">
                            <span className="font-medium">{transaction.transactionCode}</span>
                            <span className="text-sm text-gray-500">
                              Amount: {transaction.totalPaidAmount.toLocaleString()}
                              {" • "}
                              Remaining: {transaction.remainingBalance.toLocaleString()}
                            </span>
                          </div>
                        </MenuItem>
                      ))
                    )}
                  </TextField>
                )}
              />
            )}
          </div>
        )}
        {/* Actions */}
        <div className="flex items-center justify-center gap-4 p-6">
          <button
            type="button"
            onClick={handleClose}
            className="min-w-[120px] rounded-lg border border-[#d1d5db] px-4 py-2 text-[#1a1a1a] transition-colors hover:border-[#9ca3af] hover:bg-[#f9fafb] disabled:opacity-60"
            disabled={completePaymentMutation.isPending || !paymentDetail}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex min-w-[120px] cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#6C63FF] px-4 py-2 text-white transition-colors hover:bg-[#5a52e6] disabled:opacity-60"
            disabled={completePaymentMutation.isPending || !paymentDetail}
          >
            {completePaymentMutation.isPending ? "Loading..." : "Save"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
