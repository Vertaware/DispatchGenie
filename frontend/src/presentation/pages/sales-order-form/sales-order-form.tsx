"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircularProgress } from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { FormDate, FormInput, FormNumber, FormSelect } from "~/components/form";
import { TRUCK_SIZES_OPTIONS, TRUCK_TYPE_OPTIONS } from "~/domain/constants/options";
import type { SalesOrder } from "~/domain/entities/sales-order";
import { UserRole } from "~/domain/enums/enum";
import {
  updateSalesOrder,
  type UpdateSalesOrderInput,
} from "~/infrastructure/services/sales-order.service";
import SalesOrderLineItems from "~/presentation/components/sales-order-line-items";
import useAuth from "~/presentation/hooks/useAuth";
import { useSnackbar } from "~/shared/contexts";

interface SalesOrderFormProps {
  data: SalesOrder | null | undefined;
}

const salesOrderArticleSchema = z.object({
  articleId: z.string().nullable().optional(),
  articleDescription: z.string().nullable().optional(),
  articleQuantity: z.string().nullable().optional(),
});

const updateSalesOrderSchema = z.object({
  soNumber: z.string().optional().nullable(),
  soDate: z.string().optional(),
  customerId: z.string().optional().nullable(),
  customerName: z.string().optional().nullable(),
  partyName: z.string().optional().nullable(),
  tripReferenceNo: z.string().optional().nullable(),
  townName: z.string().optional().nullable(),
  pinCode: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  articleDescription: z.string().optional().nullable(),
  soCases: z.string().optional().nullable(),
  requestedOrderQuantity: z.string().optional().nullable(),
  caseLot: z.string().optional().nullable(),
  unitPrice: z.string().optional().nullable(),
  plant: z.string().optional().nullable(),
  requestedTruckSize: z.string().optional().nullable(),
  requestedTruckType: z.string().optional().nullable(),
  placedTruckSize: z.string().optional().nullable(),
  placedTruckType: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  partyAddress: z.string().optional().nullable(),
  frightCost: z.string().optional().nullable(),
  articles: z.array(salesOrderArticleSchema).optional(),
});

type UpdateSalesOrderFormData = z.infer<typeof updateSalesOrderSchema>;

export default function SalesOrderForm({ data }: SalesOrderFormProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const { session } = useAuth();
  const userRole = (session?.user as any)?.user?.role as UserRole | undefined;
  const isAdmin = userRole === UserRole.ADMIN;

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<UpdateSalesOrderFormData>({
    mode: "onChange",
    resolver: zodResolver(updateSalesOrderSchema),
    defaultValues: {
      soNumber: "",
      soDate: "",
      customerId: "",
      customerName: "",
      partyName: "",
      tripReferenceNo: null,
      townName: "",
      pinCode: "",
      sku: "",
      articleDescription: "",
      soCases: "",
      requestedOrderQuantity: "",
      caseLot: "",
      unitPrice: "",
      plant: "",
      requestedTruckSize: "",
      requestedTruckType: "",
      placedTruckSize: "",
      placedTruckType: "",
      category: "",
      partyAddress: "",
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

  useEffect(() => {
    if (data) {
      reset({
        soNumber: data.soNumber || "",
        soDate: data.soDate || "",
        customerId: data.customerId || "",
        customerName: data.customerName || "",
        partyName: data.partyName || "",
        tripReferenceNo: data.tripReferenceNo ? data.tripReferenceNo.toString() : null,
        townName: data.townName || "",
        pinCode: data.pinCode || "",
        sku: data.sku || "",
        articleDescription: data.articleDescription || "",
        soCases: data.soCases?.toString() || "",
        requestedOrderQuantity: "",
        caseLot: data.caseLot || "",
        unitPrice: "",
        plant: "",
        requestedTruckSize: data.requestedTruckSize || "",
        requestedTruckType: data.requestedTruckType || "",
        placedTruckSize: data.placedTruckSize || "",
        placedTruckType: data.placedTruckType || "",
        category: "",
        partyAddress: data.partyAddress || "",
        frightCost: data.frightCost?.toString() || "",
        articles:
          data.articles && data.articles.length > 0
            ? data.articles.map((article) => ({
                articleId: article.articleId ?? null,
                articleDescription: article.articleDescription ?? null,
                articleQuantity: article.articleQuantity
                  ? article.articleQuantity.toString()
                  : null,
              }))
            : [],
      });
    }
  }, [data, reset]);

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateSalesOrderInput & Record<string, any>) =>
      updateSalesOrder(data!.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["getSalesOrder", data?.id] });
      showSnackbar({
        message: "Sales order updated successfully.",
        severity: "success",
      });
      router.push("/sales-orders");
    },
    onError: (error: unknown) => {
      const data = (error as any).response?.data?.message;
      const message = data
        ? Array.isArray(data)
          ? data.join(", ")
          : data
        : "Unable to update sales order.";
      showSnackbar({ message, severity: "error" });
    },
  });

  const onSubmit = async (formData: UpdateSalesOrderFormData) => {
    if (!data) return;

    const toNullIfEmpty = (value?: string | null): string | null => {
      const trimmed = value?.trim();
      return trimmed && trimmed.length > 0 ? trimmed : null;
    };

    const toNumberOrNull = (value?: string | null): number | null => {
      if (!value || value.trim() === "") return null;
      const parsed = parseFloat(value);
      return isNaN(parsed) ? null : parsed;
    };

    const payload: UpdateSalesOrderInput & Record<string, any> = {
      soDate: formData.soDate || undefined,
      customerId: toNullIfEmpty(formData.customerId),
      customerName: toNullIfEmpty(formData.customerName),
      partyName: toNullIfEmpty(formData.partyName),
      tripReferenceNo: formData.tripReferenceNo ? Number(formData.tripReferenceNo) : null,
      townName: toNullIfEmpty(formData.townName),
      pinCode: toNullIfEmpty(formData.pinCode),
      sku: toNullIfEmpty(formData.sku),
      articleDescription: toNullIfEmpty(formData.articleDescription),
      soCases: toNumberOrNull(formData.soCases)?.toString() || null,
      requestedOrderQuantity: toNumberOrNull(formData.requestedOrderQuantity)?.toString() || null,
      caseLot: toNullIfEmpty(formData.caseLot),
      unitPrice: toNumberOrNull(formData.unitPrice)?.toString() || null,
      plant: toNullIfEmpty(formData.plant),
      requestedTruckSize: toNullIfEmpty(formData.requestedTruckSize),
      requestedTruckType: toNullIfEmpty(formData.requestedTruckType) || null,
      placedTruckSize: toNullIfEmpty(formData.placedTruckSize),
      placedTruckType: toNullIfEmpty(formData.placedTruckType) || null,
      category: toNullIfEmpty(formData.category),
      partyAddress: toNullIfEmpty(formData.partyAddress),
      articles:
        formData.articles && formData.articles.length > 0
          ? formData.articles.map((article) => ({
              articleId:
                article.articleId && article.articleId.trim() !== ""
                  ? article.articleId
                  : undefined,
              articleDescription:
                article.articleDescription && article.articleDescription.trim() !== ""
                  ? article.articleDescription
                  : undefined,
              articleQuantity: article.articleQuantity
                ? Number(article.articleQuantity)
                : undefined,
            }))
          : undefined,
    };

    // Only include frightCost if user is admin
    if (isAdmin && formData.frightCost) {
      const frightCostValue = toNumberOrNull(formData.frightCost);
      if (frightCostValue !== null && frightCostValue >= 0) {
        payload.frightCost = frightCostValue;
      }
    }

    await updateMutation.mutateAsync(payload);
  };

  if (!data) {
    return (
      <div className="flex size-full min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-gray-600">No sales order data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="flex flex-col gap-6">
          {/* Basic Information Section */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Basic Information</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormInput label="SO Number" name="soNumber" control={control} disabled />
              <FormDate
                label="Sales Order Date"
                name="soDate"
                control={control}
                error={!!errors.soDate}
                helperText={errors.soDate?.message}
              />
              <FormInput
                label="Customer ID"
                name="customerId"
                control={control}
                error={!!errors.customerId}
                helperText={errors.customerId?.message}
              />
              <FormInput
                label="Customer Name"
                name="customerName"
                control={control}
                error={!!errors.customerName}
                helperText={errors.customerName?.message}
              />
              <FormInput
                label="Party Name"
                name="partyName"
                control={control}
                error={!!errors.partyName}
                helperText={errors.partyName?.message}
              />
              <FormNumber
                label="Trip Reference Number"
                name="tripReferenceNo"
                control={control}
                error={!!errors.tripReferenceNo}
                helperText={errors.tripReferenceNo?.message}
              />
            </div>
          </div>
          {/* Location Information Section */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Location Information</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormInput
                label="Town Name"
                name="townName"
                control={control}
                error={!!errors.townName}
                helperText={errors.townName?.message}
              />
              <FormInput
                label="Pin Code"
                name="pinCode"
                control={control}
                error={!!errors.pinCode}
                helperText={errors.pinCode?.message}
              />
              <div className="md:col-span-2">
                <FormInput
                  label="Party Address"
                  name="partyAddress"
                  control={control}
                  error={!!errors.partyAddress}
                  helperText={errors.partyAddress?.message}
                  multiline
                  rows={3}
                />
              </div>
            </div>
          </div>
          {/* Product Information Section */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Product Information</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormInput
                label="SKU"
                name="sku"
                control={control}
                error={!!errors.sku}
                helperText={errors.sku?.message}
              />
              <FormInput
                label="Category"
                name="category"
                control={control}
                error={!!errors.category}
                helperText={errors.category?.message}
              />
              <div className="md:col-span-2">
                <SalesOrderLineItems
                  control={control}
                  fields={fields}
                  append={append}
                  remove={remove}
                  setValue={setValue}
                  errors={errors}
                />
              </div>
              <FormNumber
                label="SO Cases"
                name="soCases"
                control={control}
                error={!!errors.soCases}
                helperText={errors.soCases?.message}
                disabled
              />
              <FormNumber
                label="Requested Order Quantity"
                name="requestedOrderQuantity"
                control={control}
                error={!!errors.requestedOrderQuantity}
                helperText={errors.requestedOrderQuantity?.message}
              />
              <FormInput
                label="Case Lot"
                name="caseLot"
                control={control}
                error={!!errors.caseLot}
                helperText={errors.caseLot?.message}
              />
              <FormNumber
                label="Unit Price"
                name="unitPrice"
                control={control}
                error={!!errors.unitPrice}
                helperText={errors.unitPrice?.message}
              />
              <FormInput
                label="Plant"
                name="plant"
                control={control}
                error={!!errors.plant}
                helperText={errors.plant?.message}
              />
            </div>
          </div>
          {/* Truck Information Section */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Truck Information</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
              <FormSelect
                label="Placed Truck Size"
                name="placedTruckSize"
                control={control}
                error={!!errors.placedTruckSize}
                helperText={errors.placedTruckSize?.message}
                size="small"
                options={TRUCK_SIZES_OPTIONS}
              />
              <FormSelect
                label="Placed Truck Type"
                name="placedTruckType"
                control={control}
                error={!!errors.placedTruckType}
                helperText={errors.placedTruckType?.message}
                size="small"
                options={TRUCK_TYPE_OPTIONS}
              />
            </div>
          </div>
          {/* Financial Information Section - Admin Only */}
          {isAdmin && (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Financial Information</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormNumber
                  label="Fright Cost"
                  name="frightCost"
                  control={control}
                  error={!!errors.frightCost}
                  helperText={errors.frightCost?.message}
                />
              </div>
            </div>
          )}
          {/* Submit Button */}
          <div className="flex items-center justify-end gap-4">
            <button
              type="submit"
              className="flex min-w-[120px] cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#6C63FF] px-6 py-2 text-white transition-colors hover:bg-[#5a52e6] disabled:opacity-60"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <>
                  <CircularProgress size={18} color="inherit" />
                  <span>Saving...</span>
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
