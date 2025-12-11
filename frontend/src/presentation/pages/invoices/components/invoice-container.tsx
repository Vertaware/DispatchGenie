"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import type { Invoice } from "~/domain/entities/invoice";
import type { MarkInvoicePaidFormData } from "~/domain/schemas/mark-invoice-paid.schema";
import {
  exportInvoices,
  markInvoicePaid,
  type ListInvoicesParams,
  type MarkInvoicePaidInput,
} from "~/infrastructure/services/invoice.service";
import type { ListVehiclesParams } from "~/infrastructure/services/vehicle.service";
import { invoiceQueryKeys, useInvoices } from "~/presentation/hooks/useInvoices";
import { useVehicles } from "~/presentation/hooks/useVehicles";
import { useSnackbar } from "~/shared/contexts";
import ColumnsPopover, { DEFAULT_COLUMNS, type ColumnConfig } from "./columns-popover";
import CreateInvoiceModal from "./create-invoice-modal";
import FilterPanel, { type InvoiceFilters } from "./filter-panel";
import InvoiceTable from "./invoice-table";
import InvoiceTableControls, { type ViewMode } from "./invoice-table-controls";
import InvoiceTablePagination from "./invoice-table-pagination";
import MarkInvoicePaidModal from "./mark-invoice-paid-modal";
import SortPopover, { type SortConfig } from "./sort-popover";
import VehicleTable from "./vehicle-table";

export default function InvoiceContainer() {
  const queryClient = useQueryClient();
  const { showSnackbar } = useSnackbar();
  const [selectedDate, setSelectedDate] = useState<"today" | "yesterday" | "all">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [isExporting, setIsExporting] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("INVOICED");

  // Vehicle selection state (for Non-Invoiced view)
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<Set<string>>(new Set());
  const [isCreateInvoiceModalOpen, setIsCreateInvoiceModalOpen] = useState(false);

  // Mark paid modal state
  const [isMarkPaidModalOpen, setIsMarkPaidModalOpen] = useState(false);
  const [selectedInvoiceForMarkPaid, setSelectedInvoiceForMarkPaid] = useState<Invoice | null>(
    null,
  );

  // Sort state
  const [sortAnchorEl, setSortAnchorEl] = useState<HTMLElement | null>(null);
  const [currentSort, setCurrentSort] = useState<SortConfig | null>(null);

  // Filter state
  const [filterAnchorEl, setFilterAnchorEl] = useState<HTMLElement | null>(null);
  const [additionalFilters, setAdditionalFilters] = useState<InvoiceFilters>({});

  // Columns state
  const [columnsAnchorEl, setColumnsAnchorEl] = useState<HTMLElement | null>(null);
  const [columns, setColumns] = useState<ColumnConfig[]>(() =>
    DEFAULT_COLUMNS.map((col) => ({ ...col, visible: true })),
  );

  const filters = useMemo(() => {
    const baseFilters: InvoiceFilters = { ...additionalFilters };

    if (selectedDate !== "all") {
      const baseDate = selectedDate === "today" ? dayjs() : dayjs().subtract(1, "day");
      baseFilters.fromDate = baseDate.startOf("day").toISOString();
      baseFilters.toDate = baseDate.endOf("day").toISOString();
    }

    return baseFilters;
  }, [selectedDate, additionalFilters]);

  const listParams = useMemo<ListInvoicesParams>(
    () => ({
      page: currentPage,
      pageSize: rowsPerPage,
      sortBy: currentSort?.field,
      sortOrder: currentSort?.order,
      filters: filters as any,
    }),
    [currentPage, rowsPerPage, currentSort, filters],
  );

  // Invoice list query (for Invoiced view)
  const { data, isLoading, isFetching, error } = useInvoices(listParams);
  const invoices = data?.data ?? [];
  const totalResults = data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(Math.max(totalResults, 1) / rowsPerPage));

  // Vehicle list query (for Non-Invoiced view)
  const vehicleListParams = useMemo<ListVehiclesParams>(
    () => ({
      page: currentPage,
      pageSize: rowsPerPage,
      sortBy: currentSort?.field,
      sortOrder: currentSort?.order,
      filters: {
        status: "COMPLETED",
        invoiceStatus: "NONE",
      },
    }),
    [currentPage, rowsPerPage, currentSort],
  );
  const {
    data: vehiclesData,
    isLoading: vehiclesLoading,
    isFetching: vehiclesFetching,
  } = useVehicles(vehicleListParams);
  const vehicles = vehiclesData?.data ?? [];
  const vehiclesTotalResults = vehiclesData?.totalCount ?? 0;
  const vehiclesTotalPages = Math.max(
    1,
    Math.ceil(Math.max(vehiclesTotalResults, 1) / rowsPerPage),
  );

  useEffect(() => {
    if (viewMode === "INVOICED" && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
    if (viewMode === "NON_INVOICED" && currentPage > vehiclesTotalPages) {
      setCurrentPage(vehiclesTotalPages);
    }
  }, [currentPage, totalPages, vehiclesTotalPages, viewMode]);

  // Reset page when switching views
  useEffect(() => {
    setCurrentPage(1);
    setSelectedVehicleIds(new Set());
  }, [viewMode]);

  const handleRowsPerPageChange = (value: number) => {
    setRowsPerPage(value);
    setCurrentPage(1);
  };

  const handleDateChange = (value: "today" | "yesterday" | "all") => {
    setSelectedDate(value);
    setCurrentPage(1);
  };

  // Sort handlers
  const handleSortClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setSortAnchorEl(event.currentTarget);
  };

  const handleSortClose = () => {
    setSortAnchorEl(null);
  };

  const handleSortChange = (sort: SortConfig | null) => {
    setCurrentSort(sort);
    setCurrentPage(1);
  };

  // Filter handlers
  const handleFilterClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setFilterAnchorEl(event.currentTarget);
  };

  const handleFilterClose = () => {
    setFilterAnchorEl(null);
  };

  const handleApplyFilters = (filters: InvoiceFilters) => {
    setAdditionalFilters(filters);
    setCurrentPage(1);
    setFilterAnchorEl(null);
  };

  const handleClearFilters = () => {
    setAdditionalFilters({});
    setCurrentPage(1);
  };

  // Columns handlers
  const handleColumnsClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setColumnsAnchorEl(event.currentTarget);
  };

  const handleColumnsClose = () => {
    setColumnsAnchorEl(null);
  };

  const handleColumnsChange = (newColumns: ColumnConfig[]) => {
    setColumns(newColumns);
  };

  // Calculate active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    Object.entries(additionalFilters).forEach(([key, value]) => {
      if (key === "fromDate" || key === "toDate") return; // Exclude date filters
      if (value) {
        if (Array.isArray(value)) {
          count += value.length;
        } else if (typeof value === "string" && value.trim()) {
          count++;
        } else if (typeof value === "number") {
          count++;
        }
      }
    });
    return count;
  }, [additionalFilters]);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const { blob, fileName } = await exportInvoices(listParams);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showSnackbar({
        message: "Invoice report exported successfully.",
        severity: "success",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to export invoices.";
      showSnackbar({ message, severity: "error" });
    } finally {
      setIsExporting(false);
    }
  };

  // Mark invoice as paid
  const markPaidMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: MarkInvoicePaidInput }) =>
      markInvoicePaid(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceQueryKeys.all });
      showSnackbar({
        message: "Invoice marked as paid successfully.",
        severity: "success",
      });
    },
    onError: (error: unknown) => {
      const data = (error as any).response?.data?.message;
      const message = data
        ? Array.isArray(data)
          ? data.join(", ")
          : data
        : "Unable to mark invoice as paid.";
      showSnackbar({ message, severity: "error" });
    },
  });

  const handleMarkPaid = (invoiceId: string) => {
    const invoice = invoices.find((inv) => inv.id === invoiceId);
    if (invoice) {
      setSelectedInvoiceForMarkPaid(invoice);
      setIsMarkPaidModalOpen(true);
    }
  };

  const handleMarkPaidModalClose = () => {
    setIsMarkPaidModalOpen(false);
    setSelectedInvoiceForMarkPaid(null);
  };

  const handleMarkPaidSubmit = async (data: MarkInvoicePaidFormData) => {
    if (!selectedInvoiceForMarkPaid) return;

    await markPaidMutation.mutateAsync({
      id: selectedInvoiceForMarkPaid.id,
      payload: {
        paidAmount: data.paidAmount,
        paidDate: data.paidDate,
      },
    });

    setIsMarkPaidModalOpen(false);
    setSelectedInvoiceForMarkPaid(null);
  };

  // Vehicle selection handlers
  const handleVehicleSelectionChange = (vehicleId: string, selected: boolean) => {
    setSelectedVehicleIds((prev) => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(vehicleId);
      } else {
        newSet.delete(vehicleId);
      }
      return newSet;
    });
  };

  const handleSelectAllVehicles = (selected: boolean) => {
    if (selected) {
      setSelectedVehicleIds(new Set(vehicles.map((v) => v.id)));
    } else {
      setSelectedVehicleIds(new Set());
    }
  };

  const handleCreateInvoiceClick = () => {
    if (selectedVehicleIds.size > 0) {
      setIsCreateInvoiceModalOpen(true);
    }
  };

  const handleCreateInvoiceModalClose = () => {
    setIsCreateInvoiceModalOpen(false);
    setSelectedVehicleIds(new Set());
  };

  const selectedVehicles = vehicles.filter((v) => selectedVehicleIds.has(v.id));

  const errorMessage =
    error instanceof Error ? error.message : error ? "Unable to load invoices." : null;

  const displayTotalResults = viewMode === "INVOICED" ? totalResults : vehiclesTotalResults;
  const displayTotalPages = viewMode === "INVOICED" ? totalPages : vehiclesTotalPages;
  const displayLoading =
    viewMode === "INVOICED" ? isLoading || isFetching : vehiclesLoading || vehiclesFetching;

  return (
    <div className="p-4">
      <div className="rounded-lg bg-white shadow-sm">
        <InvoiceTableControls
          selectedDate={selectedDate}
          onDateChange={handleDateChange}
          onSort={handleSortClick}
          onFilter={handleFilterClick}
          onColumns={handleColumnsClick}
          onExport={handleExport}
          exportInProgress={isExporting}
          sortActive={currentSort !== null}
          filterCount={activeFilterCount}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onCreateInvoice={handleCreateInvoiceClick}
          createInvoiceDisabled={selectedVehicleIds.size === 0}
        />
        {viewMode === "INVOICED" ? (
          <>
            <InvoiceTable
              data={invoices}
              loading={displayLoading}
              currentSort={currentSort}
              columns={columns}
              onMarkPaid={handleMarkPaid}
            />
            {errorMessage ? <p className="px-4 text-sm text-red-500">{errorMessage}</p> : null}
          </>
        ) : (
          <VehicleTable
            data={vehicles}
            loading={displayLoading}
            selectedVehicleIds={selectedVehicleIds}
            onSelectionChange={handleVehicleSelectionChange}
            onSelectAll={handleSelectAllVehicles}
          />
        )}
        <InvoiceTablePagination
          currentPage={currentPage}
          totalPages={displayTotalPages}
          rowsPerPage={rowsPerPage}
          totalResults={displayTotalResults}
          onPageChange={setCurrentPage}
          onRowsPerPageChange={handleRowsPerPageChange}
        />
      </div>

      {/* Sort Popover */}
      <SortPopover
        anchorEl={sortAnchorEl}
        open={Boolean(sortAnchorEl)}
        onClose={handleSortClose}
        currentSort={currentSort}
        onSortChange={handleSortChange}
      />

      {/* Filter Panel */}
      <FilterPanel
        anchorEl={filterAnchorEl}
        open={Boolean(filterAnchorEl)}
        onClose={handleFilterClose}
        currentFilters={additionalFilters}
        onApply={handleApplyFilters}
        onClear={handleClearFilters}
      />

      {/* Columns Popover */}
      <ColumnsPopover
        anchorEl={columnsAnchorEl}
        open={Boolean(columnsAnchorEl)}
        onClose={handleColumnsClose}
        columns={columns}
        onColumnsChange={handleColumnsChange}
      />

      {/* Create Invoice Modal */}
      <CreateInvoiceModal
        open={isCreateInvoiceModalOpen}
        onClose={handleCreateInvoiceModalClose}
        selectedVehicles={selectedVehicles}
      />

      {/* Mark Invoice Paid Modal */}
      <MarkInvoicePaidModal
        open={isMarkPaidModalOpen}
        onClose={handleMarkPaidModalClose}
        invoice={selectedInvoiceForMarkPaid}
        onSubmit={handleMarkPaidSubmit}
        isLoading={markPaidMutation.isPending}
      />
    </div>
  );
}
