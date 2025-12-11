"use client";

import { Dialog } from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { HiOutlineDocumentText } from "react-icons/hi";
import { IoClose, IoCloudUploadOutline } from "react-icons/io5";
import { importSalesOrders } from "~/infrastructure/services/sales-order.service";
import { salesOrderQueryKeys } from "~/presentation/hooks/useSalesOrders";
import { useSnackbar } from "~/shared/contexts";

type ImportExcelModelProps = {
  open: boolean;
  onClose: () => void;
};

const ACCEPTED_TYPES = [".csv", ".xlsx", ".xls"];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export default function ImportExcelModel({ open, onClose }: ImportExcelModelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const queryClient = useQueryClient();
  const { showSnackbar } = useSnackbar();

  const resetState = () => {
    setSelectedFile(null);
    setError(null);
    setIsDragging(false);
  };

  const closeDialog = () => {
    resetState();
    onClose();
  };

  const importMutation = useMutation({
    mutationFn: (file: File) => importSalesOrders(file),
    onSuccess: (summary) => {
      queryClient.invalidateQueries({ queryKey: salesOrderQueryKeys.all });
      const hasFailures = summary.errors.length > 0;
      const baseMessage = `Import complete. ${summary.created} created, ${summary.updated} updated.`;
      const extraMessage = hasFailures ? ` ${summary.errors.length} rows skipped.` : "";
      showSnackbar({
        message: `${baseMessage}${extraMessage}`,
        severity: hasFailures ? "warning" : "success",
      });
      closeDialog();
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Unable to import sales orders.";
      setError(message);
      showSnackbar({ message, severity: "error" });
    },
  });
  const isSubmitting = importMutation.isPending;

  const handleClose = () => {
    if (isSubmitting) return;
    closeDialog();
  };

  const getFileExtension = (fileName: string) => {
    const segments = fileName.split(".");
    return segments.length > 1 ? `.${segments.pop()?.toLowerCase()}` : "";
  };

  const validateFile = (file: File) => {
    const extension = getFileExtension(file.name);
    if (!ACCEPTED_TYPES.includes(extension)) {
      throw new Error("Unsupported file type. Upload CSV, XLSX, or XLS.");
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new Error("File exceeds the 10MB size limit.");
    }
    return file;
  };

  const handleFileSelection = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      const validFile = validateFile(files[0]);
      setSelectedFile(validFile);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid file.";
      setError(message);
      setSelectedFile(null);
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    handleFileSelection(event.dataTransfer.files);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!isDragging) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile) {
      setError("Please select a file before submitting.");
      return;
    }
    try {
      await importMutation.mutateAsync(selectedFile);
    } catch {
      // Error handling done in mutation onError
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setError(null);
  };

  const formatFileSize = (size: number) => {
    if (size >= 1024 * 1024) {
      return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(size / 1024).toFixed(1)} KB`;
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      classes={{
        paper: "!rounded-md",
      }}
    >
      <form className="flex flex-col" onSubmit={handleSubmit}>
        {/* Header */}
        <div className="relative flex flex-col gap-1 border-b border-[#E5E7EB] p-6">
          <h2 className="text-2xl font-bold text-[#111827]">Upload Order Data</h2>
          <p className="text-sm text-[#6B7280]">
            Upload a CSV or Excel file containing order data. The file will be validated and
            previewed before import.
          </p>
          <button
            onClick={handleClose}
            className="absolute right-4 top-6 rounded p-1 text-[#ef4444] transition-colors hover:bg-red-50 disabled:opacity-60"
            aria-label="close"
            type="button"
            disabled={isSubmitting}
          >
            <IoClose className="text-xl" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 p-6">
          <div
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-all ${
              isDragging ? "border-[#6366f1] bg-indigo-50" : "border-[#D1D5DB] bg-[#F9FAFB]"
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            role="button"
            tabIndex={0}
            onClick={handleBrowseClick}
          >
            <IoCloudUploadOutline className="mb-4 text-4xl text-[#6366f1]" />
            <p className="text-base font-medium text-[#111827]">Drag and drop your file here, or</p>
            <button
              type="button"
              onClick={handleBrowseClick}
              className="mt-3 rounded-md bg-white px-4 py-2 text-sm font-medium text-[#4F46E5] shadow-sm ring-1 ring-inset ring-[#E5E7EB] transition hover:bg-[#EEF2FF]"
            >
              Browse File
            </button>
            <p className="mt-3 text-xs text-[#6B7280]">
              Supported formats: CSV, XLSX, XLS (Max 10MB)
            </p>
            <input
              type="file"
              ref={fileInputRef}
              accept={ACCEPTED_TYPES.join(",")}
              onChange={(event) => {
                handleFileSelection(event.target.files);
                if (event.target) {
                  event.target.value = "";
                }
              }}
              className="hidden"
            />
          </div>

          {selectedFile && (
            <div className="flex items-center justify-between rounded-lg border border-[#E5E7EB] bg-white p-4">
              <div className="flex items-center gap-3">
                <HiOutlineDocumentText className="text-2xl text-[#6366f1]" />
                <div className="text-left">
                  <p className="text-sm font-medium text-[#111827]">{selectedFile.name}</p>
                  <p className="text-xs text-[#6B7280]">{formatFileSize(selectedFile.size)}</p>
                </div>
              </div>
              <button
                type="button"
                className="text-sm font-medium text-[#EF4444] hover:underline"
                onClick={handleRemoveFile}
                disabled={isSubmitting}
              >
                Remove
              </button>
            </div>
          )}

          {error && (
            <p className="text-sm font-medium text-[#EF4444]" role="alert">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-[#E5E7EB] px-6 py-4">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md border border-[#D1D5DB] px-5 py-2 text-sm font-medium text-[#374151] transition hover:bg-[#F3F4F6] disabled:opacity-60"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-md bg-[#4F46E5] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4338CA] disabled:cursor-not-allowed disabled:bg-[#A5B4FC]"
            disabled={!selectedFile || isSubmitting}
          >
            {isSubmitting ? "Submitting..." : "Submit"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
