"use client";

import { Badge, Button } from "@mui/material";
import { IoDownloadOutline, IoFilter, IoGrid } from "react-icons/io5";
import { LuChevronsUpDown } from "react-icons/lu";

export type ViewMode = "INVOICED" | "NON_INVOICED";

type TableControlsProps = {
  selectedDate: "today" | "yesterday" | "all";
  onDateChange: (date: "today" | "yesterday" | "all") => void;
  onSort?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onFilter?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onColumns?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onExport?: () => void;
  exportInProgress?: boolean;
  sortActive?: boolean;
  filterCount?: number;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  onCreateInvoice?: () => void;
  createInvoiceDisabled?: boolean;
};

export default function InvoiceTableControls({
  selectedDate,
  onDateChange,
  onSort,
  onFilter,
  onColumns,
  onExport,
  exportInProgress = false,
  sortActive = false,
  filterCount = 0,
  viewMode = "INVOICED",
  onViewModeChange,
  onCreateInvoice,
  createInvoiceDisabled = false,
}: TableControlsProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-2">
        {/* View Mode Toggle */}
        {onViewModeChange && (
          <div className="flex items-center overflow-hidden rounded-md border border-gray-300">
            <button
              onClick={() => onViewModeChange("INVOICED")}
              className={`px-4 py-1.5 text-sm transition-colors ${
                viewMode === "INVOICED"
                  ? "bg-gray-800 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Invoiced
            </button>
            <button
              onClick={() => onViewModeChange("NON_INVOICED")}
              className={`border-l border-gray-300 px-4 py-1.5 text-sm transition-colors ${
                viewMode === "NON_INVOICED"
                  ? "bg-gray-800 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Non-Invoiced
            </button>
          </div>
        )}
        <Button
          onClick={onSort}
          variant="text"
          startIcon={
            <LuChevronsUpDown
              className={`size-4 ${sortActive ? "text-[#6C63FF]" : "text-gray-600"}`}
            />
          }
          sx={{
            backgroundColor: sortActive ? "#EFF0FE" : "transparent",
            "&:hover": {
              backgroundColor: sortActive ? "#E5E7FE" : "#F9FAFB",
            },
          }}
        >
          <span
            className={`text-sm capitalize ${
              sortActive ? "font-semibold text-[#6C63FF]" : "text-gray-700"
            }`}
          >
            Sort
          </span>
        </Button>
        <Badge
          badgeContent={filterCount}
          color="primary"
          sx={{
            "& .MuiBadge-badge": {
              backgroundColor: "#6C63FF",
              fontWeight: 600,
            },
          }}
        >
          <Button
            onClick={onFilter}
            variant="text"
            startIcon={
              <IoFilter
                className={`size-4 ${filterCount > 0 ? "text-[#6C63FF]" : "text-gray-600"}`}
              />
            }
            sx={{
              backgroundColor: filterCount > 0 ? "#EFF0FE" : "transparent",
              "&:hover": {
                backgroundColor: filterCount > 0 ? "#E5E7FE" : "#F9FAFB",
              },
            }}
          >
            <span
              className={`text-sm capitalize ${
                filterCount > 0 ? "font-semibold text-[#6C63FF]" : "text-gray-700"
              }`}
            >
              Filter
            </span>
          </Button>
        </Badge>
        <Button
          variant="text"
          onClick={onColumns}
          startIcon={<IoGrid className="size-4 text-gray-600" />}
        >
          <span className="text-sm capitalize text-gray-700">Columns</span>
        </Button>
      </div>
      <div className="flex items-center gap-2">
        {/* Create Invoice Button - Only shown in Non-Invoiced mode */}
        {viewMode === "NON_INVOICED" && onCreateInvoice && (
          <Button
            variant="contained"
            className="!capitalize"
            onClick={onCreateInvoice}
            disabled={createInvoiceDisabled}
            sx={{
              backgroundColor: "#6C63FF",
              "&:hover": {
                backgroundColor: "#5a52e6",
              },
              "&:disabled": {
                backgroundColor: "#e5e7eb",
                color: "#9ca3af",
              },
            }}
          >
            Create Invoice
          </Button>
        )}
        <div className="flex items-center overflow-hidden rounded-md border border-gray-300">
          <button
            onClick={() => onDateChange("all")}
            className={`border-l border-gray-300 px-4 py-1.5 text-sm transition-colors ${
              selectedDate === "all"
                ? "bg-gray-800 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            All
          </button>
          <button
            onClick={() => onDateChange("today")}
            className={`px-4 py-1.5 text-sm transition-colors ${
              selectedDate === "today"
                ? "bg-gray-800 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            Today
          </button>
          <button
            onClick={() => onDateChange("yesterday")}
            className={`border-l border-gray-300 px-4 py-1.5 text-sm transition-colors ${
              selectedDate === "yesterday"
                ? "bg-gray-800 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            Yesterday
          </button>
        </div>
        <Button
          variant="text"
          onClick={onExport}
          disabled={exportInProgress}
          startIcon={<IoDownloadOutline className="size-4 text-gray-600" />}
          className="border-gray-300"
        >
          <span className="text-sm capitalize text-gray-700">
            {exportInProgress ? "Exporting..." : "Export"}
          </span>
        </Button>
      </div>
    </div>
  );
}
