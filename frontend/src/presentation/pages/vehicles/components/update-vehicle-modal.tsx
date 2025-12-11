"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircularProgress, Dialog } from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { IoClose } from "react-icons/io5";
import { FormInput, FormNumber, FormSelect } from "~/components/form";
import { TRUCK_SIZES_OPTIONS, TRUCK_TYPE_OPTIONS } from "~/domain/constants/options";
import type { Vehicle } from "~/domain/entities/vehicle";
import { updateVehicleSchema, type UpdateVehicleFormData } from "~/domain/schemas/vehicle.schema";
import { vehicleQueryKeys } from "~/hooks/useVehicles";
import {
  deleteDocument,
  getDocumentViewerUrl,
  updateVehicle,
  uploadVehicleInvoicePdf,
  uploadVehicleLrCopy,
} from "~/infrastructure/services";
import type {
  UpdateVehicleInput,
  VehicleDocument,
} from "~/infrastructure/services/vehicle.service";
import { useSnackbar } from "~/shared/contexts";

type UpdateVehicleModalProps = {
  open: boolean;
  onClose: () => void;
  vehicle: Vehicle | null;
  documents?: VehicleDocument[];
};

const STATUS_OPTIONS = [
  { label: "Assigned", value: "ASSIGNED", disabled: true },
  { label: "Arrived", value: "ARRIVED", disabled: true },
  { label: "Gate In", value: "GATE_IN", disabled: true },
  { label: "Loading Start", value: "LOADING_START" },
  { label: "Loading Complete", value: "LOADING_COMPLETE" },
  { label: "Trip Invoiced", value: "TRIP_INVOICED" },
  { label: "Gate Out", value: "GATE_OUT" },
  { label: "In Journey", value: "IN_JOURNEY" },
  { label: "Completed", value: "COMPLETED" },
];

export default function UpdateVehicleModal({
  open,
  onClose,
  vehicle,
  documents = [],
}: UpdateVehicleModalProps) {
  const queryClient = useQueryClient();
  const { data: session }: any = useSession();
  const { showSnackbar } = useSnackbar();
  const [uploading, setUploading] = useState(false);
  const [docList, setDocList] = useState<VehicleDocument[]>(documents ?? []);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<UpdateVehicleFormData>({
    mode: "onChange",
    resolver: zodResolver(updateVehicleSchema),
    defaultValues: {
      vehicleNumber: "",
      driverName: "",
      driverPhone: "",
      vehicleAmount: "",
      placedTruckSize: "",
      placedTruckType: "",
      asmPhoneNumber: "",
      status: "",
      loadingQuantity: "",
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateVehicleInput }) =>
      updateVehicle(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vehicleQueryKeys.lists() });
      if (vehicle) {
        queryClient.invalidateQueries({ queryKey: vehicleQueryKeys.detail(vehicle.id) });
      }
      showSnackbar({
        message: "Vehicle updated successfully",
        severity: "success",
      });
      reset();
      onClose();
    },
    onError: (error: unknown) => {
      const message =
        (error as any)?.response?.data?.message ||
        (error instanceof Error ? error.message : "Failed to update vehicle");
      showSnackbar({
        message,
        severity: "error",
      });
    },
  });

  const handleClose = () => {
    if (updateMutation.isPending || uploading) return;
    reset();
    setDocList(documents ?? []);
    onClose();
  };

  useEffect(() => {
    if (open && vehicle) {
      reset({
        vehicleNumber: vehicle.vehicleNumber || "",
        driverName: vehicle.driverName || "",
        driverPhone: vehicle.driverPhoneNumber || "",
        placedTruckSize: vehicle.placedTruckSize || "",
        placedTruckType: vehicle.placedTruckType || "",
        vehicleAmount: vehicle.vehicleAmount?.toString() || "",
        asmPhoneNumber: vehicle.asmPhoneNumber || "",
        status: STATUS_OPTIONS.find((option) => option.value === vehicle.status)?.value || "",
        loadingQuantity: vehicle.loadingQuantity?.toString() || "",
      });
      setDocList(documents ?? []);
    }
  }, [open, vehicle, documents, reset]);

  const hasLrCopy = useMemo(() => docList.some((doc) => doc.type === "LR_COPY"), [docList]);
  const hasInvoicePdf = useMemo(() => docList.some((doc) => doc.type === "INVOICE_PDF"), [docList]);

  const onSubmit = async (data: UpdateVehicleFormData) => {
    if (!vehicle) return;
    if (data.status === "TRIP_INVOICED" && (!hasLrCopy || !hasInvoicePdf)) {
      showSnackbar({
        message: "Upload LR Copy and Invoice PDF before marking as TRIP_INVOICED",
        severity: "error",
      });
      return;
    }

    const payload = {
      vehicleNumber: data.vehicleNumber,
      driverName: data.driverName,
      driverPhoneNumber: data.driverPhone,
      vehicleAmount: data.vehicleAmount,
      placedTruckSize: data.placedTruckSize,
      placedTruckType: data.placedTruckType,
      asmPhoneNumber: data.asmPhoneNumber,
      status: data.status,
      loadingQuantity: data.loadingQuantity,
    };

    await updateMutation.mutateAsync({ id: vehicle.id, payload });
  };

  const handleUpload = async (file: File | undefined, type: "LR_COPY" | "INVOICE_PDF") => {
    if (!file || !vehicle) return;
    setUploading(true);
    try {
      if (type === "LR_COPY") {
        const uploaded = await uploadVehicleLrCopy(vehicle.id, file);
        setDocList((prev) => [...prev.filter((d) => d.type !== "LR_COPY"), uploaded]);
      } else {
        const uploaded = await uploadVehicleInvoicePdf(vehicle.id, file);
        setDocList((prev) => [...prev.filter((d) => d.type !== "INVOICE_PDF"), uploaded]);
      }
      showSnackbar({
        message: `${type === "LR_COPY" ? "LR Copy" : "Invoice PDF"} uploaded successfully`,
        severity: "success",
      });
    } catch (error) {
      showSnackbar({
        message: error instanceof Error ? error.message : "Upload failed. Please try again.",
        severity: "error",
      });
    } finally {
      setUploading(false);
    }
  };

  const fetchDocument = async (url: string) => {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/pdf",
        Authorization: `Bearer ${session?.user?.token}`,
      },
    });
    return response.blob();
  };

  const handleViewDocument = async (doc: VehicleDocument) => {
    try {
      const { url } = await getDocumentViewerUrl(doc.id);
      const blob = await fetchDocument(url);
      const newWindow = window.open(URL.createObjectURL(blob), "_blank", "noopener,noreferrer");
      if (newWindow) {
        newWindow.document.title = doc.fileName;
      } else {
        showSnackbar({ message: "Unable to open document.", severity: "error" });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to open document.";
      showSnackbar({ message, severity: "error" });
    }
  };

  const handleDeleteDocument = async (doc: VehicleDocument) => {
    try {
      await deleteDocument(doc.id);
      setDocList((prev) => prev.filter((d) => d.id !== doc.id));
      showSnackbar({ message: "Document deleted", severity: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Delete failed. Please try again.";
      showSnackbar({ message, severity: "error" });
    }
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
        <h2 className="text-2xl font-bold text-[#1a1a1a]">Update Vehicle Details</h2>
        <p className="text-sm font-normal text-[#6B7280]">Enter the details for update vehicle</p>
        <button
          onClick={handleClose}
          className="absolute right-4 top-6 cursor-pointer rounded p-1 text-[#ef4444] transition-colors hover:bg-red-50 disabled:opacity-60"
          aria-label="close"
          disabled={updateMutation.isPending}
        >
          <IoClose className="text-xl" />
        </button>
      </div>
      {/* Content */}
      <form className="px-6" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <FormInput
              label="Vehicle Number"
              name="vehicleNumber"
              control={control}
              error={!!errors.vehicleNumber}
              helperText={errors.vehicleNumber?.message}
              required
            />
            <FormInput
              label="Driver Name"
              name="driverName"
              control={control}
              error={!!errors.driverName}
              helperText={errors.driverName?.message}
              required
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <FormNumber
              label="Driver Phone Number"
              name="driverPhone"
              control={control}
              error={!!errors.driverPhone}
              helperText={errors.driverPhone?.message}
              required
            />
            <FormNumber
              label="Vehicle Amount"
              name="vehicleAmount"
              control={control}
              error={!!errors.vehicleAmount}
              helperText={errors.vehicleAmount?.message}
              required
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <FormSelect
              control={control}
              name="placedTruckSize"
              label="Placed Truck Size"
              size="small"
              options={TRUCK_SIZES_OPTIONS}
              disabled={updateMutation.isPending}
              error={!!errors.placedTruckSize}
              helperText={errors.placedTruckSize?.message}
            />
            <FormSelect
              control={control}
              name="placedTruckType"
              label="Placed Truck Type"
              size="small"
              options={TRUCK_TYPE_OPTIONS}
              disabled={updateMutation.isPending}
              error={!!errors.placedTruckType}
              helperText={errors.placedTruckType?.message}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <FormNumber
              control={control}
              name="asmPhoneNumber"
              label="ASM Phone Number"
              error={!!errors.asmPhoneNumber}
              helperText={errors.asmPhoneNumber?.message}
              required
            />
            <FormSelect
              control={control}
              name="status"
              label="Status"
              size="small"
              options={STATUS_OPTIONS}
              disabled={updateMutation.isPending}
              error={!!errors.status}
              helperText={errors.status?.message}
            />
          </div>
          {watch("status") === "LOADING_COMPLETE" && (
            <div>
              <FormNumber
                control={control}
                name="loadingQuantity"
                label="Loading Quantity"
                error={!!errors.loadingQuantity}
                helperText={errors.loadingQuantity?.message}
                required
              />
            </div>
          )}
          {watch("status") === "TRIP_INVOICED" && (
            <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center gap-3 text-sm font-semibold text-gray-800">
                <span>Trip Documents</span>
                <StatusPill label="LR Copy" ok={hasLrCopy} />
                <StatusPill label="Invoice PDF" ok={hasInvoicePdf} />
              </div>
              <div className="flex flex-col gap-2">
                {(["LR_COPY", "INVOICE_PDF"] as const).map((type: string) => {
                  const doc = docList.find((d) => d.type === type);
                  const hasDoc = Boolean(doc);
                  return (
                    <div
                      key={type}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-white px-3 py-2 text-sm shadow-sm"
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold">
                          {type === "LR_COPY" ? "LR Copy" : "Invoice PDF"}
                        </span>
                        <span className="text-xs text-gray-500">
                          {doc?.fileName ?? "No file uploaded"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {hasDoc ? (
                          <>
                            <button
                              type="button"
                              className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                              onClick={() => handleViewDocument(doc as any)}
                              disabled={uploading}
                            >
                              View
                            </button>
                            <button
                              type="button"
                              className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                              onClick={() => handleDeleteDocument(doc as any)}
                              disabled={uploading}
                            >
                              Delete
                            </button>
                          </>
                        ) : (
                          <UploadButton
                            label={"Upload"}
                            loading={uploading}
                            disabled={uploading}
                            onFileSelected={(file: File | undefined) =>
                              handleUpload(file, type as any)
                            }
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        {/* Actions */}
        <div className="flex items-center justify-center gap-4 p-6">
          <button
            type="button"
            onClick={handleClose}
            className="min-w-[120px] cursor-pointer rounded-lg border border-[#d1d5db] px-4 py-2 text-[#1a1a1a] transition-colors hover:border-[#9ca3af] hover:bg-[#f9fafb] disabled:opacity-60"
            disabled={updateMutation.isPending}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex min-w-[120px] cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#6C63FF] px-4 py-2 text-white transition-colors hover:bg-[#5a52e6] disabled:opacity-60"
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <>
                <CircularProgress size={18} color="inherit" />
                <span>Saving...</span>
              </>
            ) : (
              "Save"
            )}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function UploadButton({
  label,
  loading,
  disabled,
  onFileSelected,
}: {
  label: string;
  loading?: boolean;
  disabled?: boolean;
  onFileSelected: (file: File | undefined) => void;
}) {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    onFileSelected(file);
    // Reset the input so selecting the same file twice still triggers change
    event.target.value = "";
  };

  return (
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-200">
      <input
        type="file"
        accept="application/pdf"
        className="hidden"
        disabled={loading || disabled}
        onChange={handleChange}
      />
      {loading ? "Uploading..." : label}
    </label>
  );
}

function StatusPill({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
        ok ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-700"
      }`}
    >
      <span className={`size-2 rounded-full ${ok ? "bg-emerald-500" : "bg-orange-400"}`} />
      {label}
    </span>
  );
}
