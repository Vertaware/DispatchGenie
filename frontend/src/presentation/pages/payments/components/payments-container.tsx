"use client";

import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import {
  exportPaymentRequests,
  type ListPaymentRequestsParams,
} from "~/infrastructure/services/payment.service";
import { usePaymentRequests } from "~/presentation/hooks/usePaymentRequests";
import { useSnackbar } from "~/shared/contexts";
import ColumnsPopover, { type ColumnConfig, DEFAULT_COLUMNS } from "./columns-popover";
import FilterPanel, { type PaymentFilters } from "./filter-panel";
import PaymentsTable from "./payments-table";
import TableControls from "./payments-table-controls";
import TablePagination from "./payments-table-pagination";
import PaymentsTotalView from "./payments-total-view";
import { type ViewMode } from "./payments-view-toggle";
import SortPopover, { type SortConfig } from "./sort-popover";
import TotalViewFilterPanel, { type TotalViewFilters } from "./total-view-filter-panel";
import TotalViewSortPopover, { type TotalViewSortConfig } from "./total-view-sort-popover";

export default function PaymentsContainer() {
  const { showSnackbar } = useSnackbar();
  const [selectedDate, setSelectedDate] = useState<"today" | "yesterday" | "all">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);

  // Sort state
  const [sortAnchorEl, setSortAnchorEl] = useState<HTMLElement | null>(null);
  const [currentSort, setCurrentSort] = useState<SortConfig | null>(null);

  // Filter state
  const [filterAnchorEl, setFilterAnchorEl] = useState<HTMLElement | null>(null);
  const [additionalFilters, setAdditionalFilters] = useState<PaymentFilters>({});

  // Columns state
  const [columnsAnchorEl, setColumnsAnchorEl] = useState<HTMLElement | null>(null);
  const [columns, setColumns] = useState<ColumnConfig[]>(() =>
    DEFAULT_COLUMNS.map((col) => ({ ...col, visible: true })),
  );

  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>("normal");

  // Total View sort state
  const [totalViewSortAnchorEl, setTotalViewSortAnchorEl] = useState<HTMLElement | null>(null);
  const [totalViewSort, setTotalViewSort] = useState<TotalViewSortConfig | null>(null);

  // Total View filter state
  const [totalViewFilterAnchorEl, setTotalViewFilterAnchorEl] = useState<HTMLElement | null>(null);
  const [totalViewFilters, setTotalViewFilters] = useState<TotalViewFilters>({});

  const filters = useMemo(() => {
    const baseFilters: PaymentFilters = { ...additionalFilters };

    if (selectedDate !== "all") {
      const baseDate = selectedDate === "today" ? dayjs() : dayjs().subtract(1, "day");
      baseFilters.fromDate = baseDate.startOf("day").toISOString();
      baseFilters.toDate = baseDate.endOf("day").toISOString();
    }

    return baseFilters;
  }, [selectedDate, additionalFilters]);

  const listParams = useMemo<ListPaymentRequestsParams>(
    () => ({
      page: currentPage,
      pageSize: rowsPerPage,
      sortBy: currentSort?.field,
      sortOrder: currentSort?.order,
      filters: filters as any,
    }),
    [currentPage, rowsPerPage, currentSort, filters],
  );

  const { data, isLoading, isFetching, error } = usePaymentRequests(listParams);
  const payments = data?.data ?? [];
  const totalResults = data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(Math.max(totalResults, 1) / rowsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(new Set(payments.map((item) => item.id)));
    } else {
      setSelectedRows(new Set());
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

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
    if (viewMode === "total") {
      setTotalViewSortAnchorEl(event.currentTarget);
    } else {
      setSortAnchorEl(event.currentTarget);
    }
  };

  const handleSortClose = () => {
    if (viewMode === "total") {
      setTotalViewSortAnchorEl(null);
    } else {
      setSortAnchorEl(null);
    }
  };

  const handleSortChange = (sort: SortConfig | null) => {
    setCurrentSort(sort);
    setCurrentPage(1);
  };

  const handleTotalViewSortChange = (sort: TotalViewSortConfig | null) => {
    setTotalViewSort(sort);
  };

  // Filter handlers
  const handleFilterClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (viewMode === "total") {
      setTotalViewFilterAnchorEl(event.currentTarget);
    } else {
      setFilterAnchorEl(event.currentTarget);
    }
  };

  const handleFilterClose = () => {
    if (viewMode === "total") {
      setTotalViewFilterAnchorEl(null);
    } else {
      setFilterAnchorEl(null);
    }
  };

  const handleApplyFilters = (filters: PaymentFilters) => {
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
    if (viewMode === "total") {
      let count = 0;
      if (totalViewFilters.status && totalViewFilters.status.length > 0) {
        count += totalViewFilters.status.length;
      }
      if (totalViewFilters.beneficiaryName) {
        count++;
      }
      return count;
    }

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
  }, [additionalFilters, totalViewFilters, viewMode]);

  const handleTotalViewFiltersApply = (filters: TotalViewFilters) => {
    setTotalViewFilters(filters);
    setTotalViewFilterAnchorEl(null);
  };

  const handleTotalViewFiltersClear = () => {
    setTotalViewFilters({});
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const { blob, fileName } = await exportPaymentRequests(listParams);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showSnackbar({
        message: "Payment report exported successfully.",
        severity: "success",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to export payment requests.";
      showSnackbar({ message, severity: "error" });
    } finally {
      setIsExporting(false);
    }
  };

  const errorMessage =
    error instanceof Error ? error.message : error ? "Unable to load payment requests." : null;

  return (
    <div className="p-4">
      <div className="rounded-lg bg-white shadow-sm">
        <TableControls
          selectedDate={selectedDate}
          onDateChange={handleDateChange}
          onSort={handleSortClick}
          onFilter={handleFilterClick}
          onColumns={handleColumnsClick}
          onExport={handleExport}
          exportInProgress={isExporting}
          sortActive={viewMode === "total" ? totalViewSort !== null : currentSort !== null}
          filterCount={activeFilterCount}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
        {viewMode === "normal" && (
          <>
            <PaymentsTable
              data={payments}
              loading={isLoading || isFetching}
              selectedRows={selectedRows}
              onSelectAll={handleSelectAll}
              onSelectRow={handleSelectRow}
              currentSort={currentSort}
              columns={columns}
            />
            {errorMessage ? <p className="px-4 text-sm text-red-500">{errorMessage}</p> : null}
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              rowsPerPage={rowsPerPage}
              totalResults={totalResults}
              onPageChange={setCurrentPage}
              onRowsPerPageChange={handleRowsPerPageChange}
            />
          </>
        )}
        {viewMode === "total" && (
          <>
            {errorMessage ? <p className="px-4 text-sm text-red-500">{errorMessage}</p> : null}
            <PaymentsTotalView
              payments={payments}
              sortConfig={totalViewSort}
              filters={totalViewFilters}
            />
          </>
        )}
      </div>

      {/* Sort Popover - Normal View */}
      {viewMode === "normal" && (
        <SortPopover
          anchorEl={sortAnchorEl}
          open={Boolean(sortAnchorEl)}
          onClose={handleSortClose}
          currentSort={currentSort}
          onSortChange={handleSortChange}
        />
      )}

      {/* Sort Popover - Total View */}
      {viewMode === "total" && (
        <TotalViewSortPopover
          anchorEl={totalViewSortAnchorEl}
          open={Boolean(totalViewSortAnchorEl)}
          onClose={handleSortClose}
          currentSort={totalViewSort}
          onSortChange={handleTotalViewSortChange}
        />
      )}

      {/* Filter Panel - Normal View */}
      {viewMode === "normal" && (
        <FilterPanel
          anchorEl={filterAnchorEl}
          open={Boolean(filterAnchorEl)}
          onClose={handleFilterClose}
          currentFilters={additionalFilters}
          onApply={handleApplyFilters}
          onClear={handleClearFilters}
        />
      )}

      {/* Filter Panel - Total View */}
      {viewMode === "total" && (
        <TotalViewFilterPanel
          anchorEl={totalViewFilterAnchorEl}
          open={Boolean(totalViewFilterAnchorEl)}
          onClose={handleFilterClose}
          currentFilters={totalViewFilters}
          onApply={handleTotalViewFiltersApply}
          onClear={handleTotalViewFiltersClear}
        />
      )}

      {/* Columns Popover */}
      <ColumnsPopover
        anchorEl={columnsAnchorEl}
        open={Boolean(columnsAnchorEl)}
        onClose={handleColumnsClose}
        columns={columns}
        onColumnsChange={handleColumnsChange}
      />
    </div>
  );
}
