"use client";

import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import {
  exportBankTransactions,
  listBankTransactions,
  type ListBankTransactionsParams,
} from "~/infrastructure/services/transaction.service";
import { useSnackbar } from "~/shared/contexts";
import ColumnsPopover, { type ColumnConfig, DEFAULT_COLUMNS } from "./columns-popover";
import FilterPanel, { type TransactionFilters } from "./filter-panel";
import SortPopover, { type SortConfig } from "./sort-popover";
import TotalViewFilterPanel, { type TotalViewFilters } from "./total-view-filter-panel";
import TotalViewSortPopover, { type TotalViewSortConfig } from "./total-view-sort-popover";
import TransactionsTable from "./transactions-table";
import TableControls from "./transactions-table-controls";
import TablePagination from "./transactions-table-pagination";
import TransactionsTotalView from "./transactions-total-view";
import { type ViewMode } from "./transactions-view-toggle";

export default function TransactionsContainer() {
  const { showSnackbar } = useSnackbar();
  const [selectedDate, setSelectedDate] = useState<"today" | "yesterday" | "all">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  // Sort state
  const [sortAnchorEl, setSortAnchorEl] = useState<HTMLElement | null>(null);
  const [currentSort, setCurrentSort] = useState<SortConfig | null>(null);

  // Filter state
  const [filterAnchorEl, setFilterAnchorEl] = useState<HTMLElement | null>(null);
  const [additionalFilters, setAdditionalFilters] = useState<TransactionFilters>({});

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
    const baseFilters: TransactionFilters = { ...additionalFilters };

    if (selectedDate !== "all") {
      const baseDate = selectedDate === "today" ? dayjs() : dayjs().subtract(1, "day");
      baseFilters.fromDate = baseDate.startOf("day").toISOString();
      baseFilters.toDate = baseDate.endOf("day").toISOString();
    }

    return baseFilters;
  }, [selectedDate, additionalFilters]);

  const listParams = useMemo<ListBankTransactionsParams>(() => {
    // Convert TransactionFilters to Record<string, string>
    const convertedFilters: Record<string, string> = {};
    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        return;
      }
      if (Array.isArray(value)) {
        convertedFilters[key] = value.join(",");
      } else {
        convertedFilters[key] = value;
      }
    });

    return {
      page: currentPage,
      pageSize: rowsPerPage,
      sortBy: currentSort?.field,
      sortOrder: currentSort?.order,
      filters: convertedFilters,
    };
  }, [currentPage, rowsPerPage, currentSort, filters]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["transactions", listParams],
    queryFn: () => listBankTransactions(listParams),
  });

  useEffect(() => {
    if (error) {
      showSnackbar({
        message: error instanceof Error ? error.message : "Failed to load transactions",
        severity: "error",
      });
    }
  }, [error, showSnackbar]);

  const transactions = data?.data || [];
  const totalPages = data ? Math.ceil(data.totalCount / data.pageSize) : 1;
  const totalResults = data?.totalCount || 0;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(new Set(transactions.map((row) => row.id)));
    } else {
      setSelectedRows(new Set());
    }
  };

  const handleSelectRow = (id: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRows(newSelected);
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

  const handleApplyFilters = (filters: TransactionFilters) => {
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
      if (totalViewFilters.beneficiaryName) {
        count++;
      }
      if (totalViewFilters.totalPaidAmount) {
        count++;
      }
      if (totalViewFilters.remainingBalance) {
        count++;
      }
      return count;
    }

    let count = 0;
    Object.entries(additionalFilters).forEach(([key, value]) => {
      if (key === "fromDate" || key === "toDate") return;
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
      const { blob, fileName } = await exportBankTransactions(listParams);

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);

      showSnackbar({
        message: "Transactions exported successfully",
        severity: "success",
      });
    } catch (error) {
      showSnackbar({
        message: error instanceof Error ? error.message : "Failed to export transactions",
        severity: "error",
      });
    }
  };

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
          sortActive={viewMode === "total" ? totalViewSort !== null : currentSort !== null}
          filterCount={activeFilterCount}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
        {viewMode === "normal" && (
          <>
            <TransactionsTable
              data={transactions}
              loading={isLoading}
              selectedRows={selectedRows}
              onSelectAll={handleSelectAll}
              onSelectRow={handleSelectRow}
              currentSort={currentSort}
              columns={columns}
            />
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              rowsPerPage={rowsPerPage}
              totalResults={totalResults}
              onPageChange={setCurrentPage}
              onRowsPerPageChange={setRowsPerPage}
            />
          </>
        )}
        {viewMode === "total" && (
          <TransactionsTotalView
            transactions={transactions}
            sortConfig={totalViewSort}
            filters={totalViewFilters}
          />
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
