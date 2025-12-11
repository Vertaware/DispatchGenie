"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircularProgress, Dialog } from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { IoClose } from "react-icons/io5";
import { FormInput } from "~/components/form";
import {
  createBeneficiarySchema,
  type CreateBeneficiaryForm,
} from "~/domain/schemas/beneficiary.schema";
import {
  createBeneficiary,
  updateBeneficiary,
  type Beneficiary,
  type CreateBeneficiaryInput,
  type UpdateBeneficiaryInput,
} from "~/infrastructure/services/beneficiary.service";
import { useSnackbar } from "~/shared/contexts";

type BeneficiaryRecordModalProps = {
  open: boolean;
  onClose: () => void;
  beneficiary?: Beneficiary | null;
};

export default function BeneficiaryRecordModal({
  open,
  onClose,
  beneficiary,
}: BeneficiaryRecordModalProps) {
  const { showSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const isEdit = Boolean(beneficiary);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateBeneficiaryForm>({
    resolver: zodResolver(createBeneficiarySchema),
    defaultValues: {
      name: "",
      accountNumber: "",
      confirmAccountNumber: "",
      bankNameAndBranch: "",
      ifscCode: "",
      contactInfo: "",
      document: undefined,
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateBeneficiaryInput) => createBeneficiary(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["beneficiaries"] });
      showSnackbar({ message: "Beneficiary created successfully", severity: "success" });
      reset();
      onClose();
    },
    onError: (error: unknown) => {
      const message =
        (error as any)?.response?.data?.message ||
        (error instanceof Error ? error.message : "Failed to create beneficiary");
      showSnackbar({ message, severity: "error" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateBeneficiaryInput }) =>
      updateBeneficiary(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["beneficiaries"] });
      showSnackbar({ message: "Beneficiary updated successfully", severity: "success" });
      reset();
      onClose();
    },
    onError: (error: unknown) => {
      const message =
        (error as any)?.response?.data?.message ||
        (error instanceof Error ? error.message : "Failed to update beneficiary");
      showSnackbar({ message, severity: "error" });
    },
  });

  useEffect(() => {
    if (open && beneficiary) {
      reset({
        name: beneficiary?.name ?? "",
        accountNumber: beneficiary?.accountNumber ?? "",
        confirmAccountNumber: beneficiary?.accountNumber ?? "",
        bankNameAndBranch: beneficiary?.bankNameAndBranch ?? "",
        ifscCode: beneficiary?.ifscCode ?? "",
        contactInfo: beneficiary?.contactInfo ?? "",
        document: undefined,
      });
    }
  }, [open, beneficiary, reset]);

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleClose = () => {
    if (isSaving) return;
    reset();
    onClose();
  };

  const documentFile = watch("document");
  const currentDocumentName =
    documentFile?.name || (beneficiary?.documentId ? "Bank Statement.pdf" : "");

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setValue("document", file);
    // Reset the input so selecting the same file twice still triggers change
    event.target.value = "";
  };

  const handleRemoveFile = () => {
    setValue("document", undefined);
  };

  const handleDownloadFile = () => {
    if (documentFile) {
      const url = URL.createObjectURL(documentFile);
      const link = document.createElement("a");
      link.href = url;
      link.download = documentFile.name;
      link.click();
      URL.revokeObjectURL(url);
    } else if (beneficiary?.documentId) {
      window.open(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api"}/documents/${beneficiary.documentId}`,
        "_blank",
        "noopener,noreferrer",
      );
    }
  };

  const onSubmit = async (data: CreateBeneficiaryForm) => {
    if (isEdit && beneficiary) {
      const payload: UpdateBeneficiaryInput = {
        name: data.name,
        bankNameAndBranch: data.bankNameAndBranch,
        ifscCode: data.ifscCode,
        contactInfo: data.contactInfo,
        document: data.document,
      };
      await updateMutation.mutateAsync({ id: beneficiary.id, payload });
      return;
    }

    const payload: CreateBeneficiaryInput = {
      name: data.name,
      accountNumber: data.accountNumber,
      bankNameAndBranch: data.bankNameAndBranch,
      ifscCode: data.ifscCode,
      contactInfo: data.contactInfo,
      document: data.document,
    };
    await createMutation.mutateAsync(payload);
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
        <h2 className="text-2xl font-bold text-[#1a1a1a]">
          {isEdit ? "Edit Beneficiary" : "Add New Beneficiary"}
        </h2>
        <p className="text-sm font-normal text-[#6B7280]">
          To add a beneficiary, fill in the required fields accurately for smooth processing.
        </p>
        <button
          onClick={handleClose}
          className="absolute right-4 top-6 cursor-pointer rounded p-1 text-[#ef4444] transition-colors hover:bg-red-50 disabled:opacity-60"
          aria-label="close"
          disabled={isSaving}
        >
          <IoClose className="text-xl" />
        </button>
      </div>
      {/* Content */}
      <form className="px-6 py-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <FormInput
              label="Beneficiary's Name"
              name="name"
              control={control}
              required
              disabled={isSaving}
              error={!!errors.name}
              helperText={errors.name?.message}
            />
            <FormInput
              label="Account Number"
              name="accountNumber"
              control={control}
              required
              disabled={isSaving}
              error={!!errors.accountNumber}
              helperText={errors.accountNumber?.message}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <FormInput
              label="Confirmation Account Number"
              name="confirmAccountNumber"
              control={control}
              required
              disabled={isSaving}
              error={!!errors.confirmAccountNumber}
              helperText={errors.confirmAccountNumber?.message}
            />
            <FormInput
              label="Bank Name and Branch"
              name="bankNameAndBranch"
              control={control}
              required
              disabled={isSaving}
              error={!!errors.bankNameAndBranch}
              helperText={errors.bankNameAndBranch?.message}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <FormInput
              label="IFSC Code"
              name="ifscCode"
              control={control}
              required
              disabled={isSaving}
              error={!!errors.ifscCode}
              helperText={errors.ifscCode?.message}
            />
            <FormInput
              label="Contact Information"
              name="contactInfo"
              control={control}
              required
              disabled={isSaving}
              error={!!errors.contactInfo}
              helperText={errors.contactInfo?.message}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">Document</label>
            {currentDocumentName ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-2">
                  <span className="truncate text-sm text-gray-700">{currentDocumentName}</span>
                  <div className="flex items-center gap-2">
                    {documentFile && (
                      <button
                        type="button"
                        onClick={handleRemoveFile}
                        disabled={isSaving}
                        className="rounded p-1 text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50"
                        title="Remove file"
                      >
                        <IoClose className="text-lg" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleDownloadFile}
                      disabled={isSaving}
                      className="rounded p-1 text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50"
                      title="Download file"
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
                {beneficiary?.documentId && !documentFile && (
                  <label className="flex cursor-pointer items-center justify-center rounded-lg border border-gray-300 px-4 py-2 transition-colors hover:bg-gray-50">
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*,.pdf"
                      onChange={handleFileChange}
                      disabled={isSaving}
                    />
                    <span className="text-sm font-medium text-[#6C63FF]">Replace Document</span>
                  </label>
                )}
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-6 transition-colors hover:bg-gray-100">
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf"
                  onChange={handleFileChange}
                  disabled={isSaving}
                />
                <svg
                  className="mb-2 size-10 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <p className="mb-1 text-sm text-gray-600">
                  Drag and drop your file here, or{" "}
                  <span className="font-medium text-[#6C63FF]">Browse File</span>
                </p>
                <p className="text-xs text-gray-500">
                  Supported formats: JPEG, PNG, PDF (Max 10MB)
                </p>
              </label>
            )}
          </div>
        </div>
        {/* Actions */}
        <div className="flex items-center justify-center gap-4 p-6">
          <button
            type="button"
            onClick={handleClose}
            className="min-w-[120px] cursor-pointer rounded-lg border border-[#d1d5db] px-4 py-2 text-[#1a1a1a] transition-colors hover:border-[#9ca3af] hover:bg-[#f9fafb] disabled:opacity-60"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex min-w-[120px] cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#6C63FF] px-4 py-2 text-white transition-colors hover:bg-[#5a52e6] disabled:opacity-60"
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <CircularProgress size={18} color="inherit" />
                <span>{isEdit ? "Saving..." : "Submitting..."}</span>
              </>
            ) : (
              <span>{isEdit ? "Save" : "Submit"}</span>
            )}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
