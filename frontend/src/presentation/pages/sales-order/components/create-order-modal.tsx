"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircularProgress, Dialog } from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { IoClose } from "react-icons/io5";
import { FormDate, FormInput, FormNumber, FormSelect } from "~/components/form";
import { TRUCK_SIZES_OPTIONS, TRUCK_TYPE_OPTIONS } from "~/domain/constants/options";
import {
  CreateSalesOrderFormData,
  createSalesOrderSchema,
} from "~/domain/schemas/sales-order.schema";
import {
  createSalesOrder,
  type CreateSalesOrderInput,
} from "~/infrastructure/services/sales-order.service";
import SalesOrderLineItems from "~/presentation/components/sales-order-line-items";
import { salesOrderQueryKeys } from "~/presentation/hooks/useSalesOrders";
import { useSnackbar } from "~/shared/contexts";

interface CreateOrderModalProps {
  open: boolean;
  onClose: () => void;
}

export default function CreateOrderModal({ open, onClose }: CreateOrderModalProps) {
  const queryClient = useQueryClient();
  const { showSnackbar } = useSnackbar();

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<CreateSalesOrderFormData>({
    mode: "onChange",
    resolver: zodResolver(createSalesOrderSchema),
    defaultValues: {
      soNumber: "",
      soDate: "",
      articleDescription: "",
      soCases: "",
      caseLot: "",
      townName: "",
      pinCode: "",
      requestedTruckSize: "",
      requestedTruckType: "",
      articles: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "articles",
  });

  const articles = useWatch({ control, name: "articles" });

  // Calculate SO Cases as the sum of all article quantities
  useEffect(() => {
    if (!articles || !Array.isArray(articles)) {
      setValue("soCases", "0", { shouldValidate: false });
      return;
    }

    const totalSoCases = articles.reduce((sum, article) => {
      const quantity = article?.articleQuantity;
      if (quantity !== undefined && quantity !== null) {
        const numValue = Number(quantity);
        return sum + (isNaN(numValue) ? 0 : numValue);
      }
      return sum;
    }, 0);

    setValue("soCases", totalSoCases.toString(), { shouldValidate: false });
  }, [articles, setValue]);

  const createMutation = useMutation({
    mutationFn: (payload: CreateSalesOrderInput) => createSalesOrder(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: salesOrderQueryKeys.all });
      showSnackbar({
        message: "Sales order created successfully.",
        severity: "success",
      });
      reset();
      onClose();
    },
    onError: (error: unknown) => {
      const data = (error as any).response?.data?.message;
      const message = data ? data.join(", ") : "Unable to create sales order.";
      showSnackbar({ message, severity: "error" });
    },
  });

  const handleClose = () => {
    if (createMutation.isPending) return;
    reset();
    onClose();
  };

  const onSubmit = async (data: CreateSalesOrderFormData) => {
    // Convert empty strings to null for optional fields
    const toNullIfEmpty = (value?: string): string | null => {
      const trimmed = value?.trim();
      return trimmed && trimmed.length > 0 ? trimmed : null;
    };

    const payload: CreateSalesOrderInput = {
      soNumber: data.soNumber,
      soDate: data.soDate,
      articleDescription: toNullIfEmpty(data.articleDescription),
      soCases: toNullIfEmpty(data.soCases),
      caseLot: toNullIfEmpty(data.caseLot),
      townName: toNullIfEmpty(data.townName),
      pinCode: toNullIfEmpty(data.pinCode),
      requestedTruckSize: toNullIfEmpty(data.requestedTruckSize),
      requestedTruckType: toNullIfEmpty(data.requestedTruckType),
      articles:
        data.articles && data.articles.length > 0
          ? data.articles.map((article) => ({
              articleId:
                article.articleId && article.articleId.trim() !== "" ? article.articleId : null,
              articleDescription:
                article.articleDescription && article.articleDescription.trim() !== ""
                  ? article.articleDescription
                  : null,
              articleQuantity: article.articleQuantity ? Number(article.articleQuantity) : null,
            }))
          : null,
    };
    await createMutation.mutateAsync(payload);
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
        <h2 className="text-2xl font-bold text-[#1a1a1a]">Create New Sales Order</h2>
        <p className="text-sm font-normal text-[#6B7280]">
          Enter the details for a new sales order
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
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <FormNumber
              label="Sales Order Number"
              name="soNumber"
              control={control}
              error={!!errors.soNumber}
              helperText={errors.soNumber?.message}
              required
            />
            <FormDate
              label="Sales Order Date"
              name="soDate"
              control={control}
              error={!!errors.soDate}
              helperText={errors.soDate?.message}
              required
            />
          </div>
          <SalesOrderLineItems
            control={control}
            fields={fields}
            append={append}
            remove={remove}
            setValue={setValue}
            errors={errors}
          />
          <div className="flex items-center justify-between gap-4">
            <FormNumber
              label="SO Cases"
              name="soCases"
              control={control}
              error={!!errors.soCases}
              helperText={errors.soCases?.message}
              disabled
            />
            <FormNumber
              label="Case Lot"
              name="caseLot"
              control={control}
              error={!!errors.caseLot}
              helperText={errors.caseLot?.message}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <FormInput
              label="Town Name"
              name="townName"
              control={control}
              error={!!errors.townName}
              helperText={errors.townName?.message}
            />
            <FormNumber
              label="Pin Code"
              name="pinCode"
              control={control}
              error={!!errors.pinCode}
              helperText={errors.pinCode?.message}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <FormSelect
              label="Requested Truck Size"
              name="requestedTruckSize"
              control={control}
              error={!!errors.requestedTruckSize}
              helperText={errors.requestedTruckSize?.message}
              size="small"
              options={TRUCK_SIZES_OPTIONS}
            />
            <FormSelect
              label="Requested Truck Type"
              name="requestedTruckType"
              control={control}
              error={!!errors.requestedTruckType}
              helperText={errors.requestedTruckType?.message}
              size="small"
              options={TRUCK_TYPE_OPTIONS}
            />
          </div>
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
                <span>Saving...</span>
              </>
            ) : (
              "Submit"
            )}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
