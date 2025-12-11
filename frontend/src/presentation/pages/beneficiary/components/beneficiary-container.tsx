"use client";

import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import {
  exportBeneficiaries,
  listBeneficiaries,
  type ListBeneficiariesParams,
} from "~/infrastructure/services/beneficiary.service";
import { useSnackbar } from "~/shared/contexts";
import BeneficiaryTable from "./beneficiary-table";
import TableControls from "./beneficiary-table-controls";
import TablePagination from "./beneficiary-table-pagination";
import ColumnsPopover, { type ColumnConfig, DEFAULT_COLUMNS } from "./columns-popover";
import FilterPanel, { type BeneficiaryFilters } from "./filter-panel";
import SortPopover, { type SortConfig } from "./sort-popover";

export default function BeneficiaryContainer() {
  const { showSnackbar } = useSnackbar();
  const [selectedDate, setSelectedDate] = useState<"today" | "yesterday" | "all">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Sort state
  const [sortAnchorEl, setSortAnchorEl] = useState<HTMLElement | null>(null);
  const [currentSort, setCurrentSort] = useState<SortConfig | null>(null);

  // Filter state
  const [filterAnchorEl, setFilterAnchorEl] = useState<HTMLElement | null>(null);
  const [additionalFilters, setAdditionalFilters] = useState<BeneficiaryFilters>({});

  // Columns state
  const [columnsAnchorEl, setColumnsAnchorEl] = useState<HTMLElement | null>(null);
  const [columns, setColumns] = useState<ColumnConfig[]>(() =>
    DEFAULT_COLUMNS.map((col) => ({ ...col, visible: true })),
  );

  const filters = useMemo(() => {
    const baseFilters: BeneficiaryFilters = { ...additionalFilters };

    if (selectedDate !== "all") {
      const baseDate = selectedDate === "today" ? dayjs() : dayjs().subtract(1, "day");
      baseFilters.fromDate = baseDate.startOf("day").toISOString();
      baseFilters.toDate = baseDate.endOf("day").toISOString();
    }

    return baseFilters;
  }, [selectedDate, additionalFilters]);

  const listParams = useMemo<ListBeneficiariesParams>(
    () => ({
      page: currentPage,
      pageSize: rowsPerPage,
      sortBy: currentSort?.field,
      sortOrder: currentSort?.order,
      filters: filters as any,
    }),
    [currentPage, rowsPerPage, currentSort, filters],
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ["beneficiaries", listParams],
    queryFn: () => listBeneficiaries(listParams),
  });

  useEffect(() => {
    if (error) {
      showSnackbar({
        message: error instanceof Error ? error.message : "Failed to load beneficiaries",
        severity: "error",
      });
    }
  }, [error, showSnackbar]);

  const beneficiaries = data?.data || [];
  const totalPages = data ? Math.ceil(data.totalCount / data.pageSize) : 1;
  const totalResults = data?.totalCount || 0;

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

  const handleApplyFilters = (filters: BeneficiaryFilters) => {
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
  }, [additionalFilters]);

  const handleExport = async () => {
    try {
      const { blob, fileName } = await exportBeneficiaries(listParams);

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);

      showSnackbar({
        message: "Beneficiaries exported successfully",
        severity: "success",
      });
    } catch (error) {
      showSnackbar({
        message: error instanceof Error ? error.message : "Failed to export beneficiaries",
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
          sortActive={currentSort !== null}
          filterCount={activeFilterCount}
        />
        <BeneficiaryTable
          data={beneficiaries}
          loading={isLoading}
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
    </div>
  );
}
