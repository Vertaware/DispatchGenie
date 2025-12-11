"use client";

import { useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { UserRole } from "~/domain/enums/enum";
import useAuth from "~/hooks/useAuth";
import { exportVehicles, type ListVehiclesParams } from "~/infrastructure/services/vehicle.service";
import { useVehicles, vehicleQueryKeys } from "~/presentation/hooks/useVehicles";
import { useSnackbar } from "~/shared/contexts";
import ColumnsPopover, {
  DEFAULT_COLUMNS,
  filterColumnsByRole,
  type ColumnConfig,
} from "./columns-popover";
import FilterPanel, { type VehicleFilters } from "./filter-panel";
import SortPopover, { type SortConfig } from "./sort-popover";
import VehicleTable from "./vehicle-table";
import VehicleTableControls from "./vehicle-table-controls";
import VehicleTablePagination from "./vehicle-table-pagination";

export default function VehicleContainer() {
  const { showSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userRole = (session?.user as any)?.user?.role as UserRole | undefined;
  const [selectedDate, setSelectedDate] = useState<"today" | "yesterday" | "all">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [isExporting, setIsExporting] = useState(false);

  // Sort state
  const [sortAnchorEl, setSortAnchorEl] = useState<HTMLElement | null>(null);
  const [currentSort, setCurrentSort] = useState<SortConfig | null>(null);

  // Filter state
  const [filterAnchorEl, setFilterAnchorEl] = useState<HTMLElement | null>(null);
  const [additionalFilters, setAdditionalFilters] = useState<VehicleFilters>({});

  // Columns state
  const [columnsAnchorEl, setColumnsAnchorEl] = useState<HTMLElement | null>(null);
  const [columns, setColumns] = useState<ColumnConfig[]>(() =>
    DEFAULT_COLUMNS.map((col) => ({ ...col, visible: true })),
  );

  const filters = useMemo(() => {
    const baseFilters: VehicleFilters = { ...additionalFilters };

    if (selectedDate !== "all") {
      const baseDate = selectedDate === "today" ? dayjs() : dayjs().subtract(1, "day");
      baseFilters.fromDate = baseDate.startOf("day").toISOString();
      baseFilters.toDate = baseDate.endOf("day").toISOString();
    }

    return baseFilters;
  }, [selectedDate, additionalFilters]);

  const listParams = useMemo<ListVehiclesParams>(() => {
    // Convert VehicleFilters to Record<string, string | string[]>
    const convertedFilters: Record<string, string | string[]> = {};
    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        return;
      }
      convertedFilters[key] = value;
    });

    return {
      page: currentPage,
      pageSize: rowsPerPage,
      sortBy: currentSort?.field,
      sortOrder: currentSort?.order,
      filters: convertedFilters,
    };
  }, [currentPage, rowsPerPage, currentSort, filters]);

  const { data, isLoading, isFetching, error } = useVehicles(listParams);
  const vehicles = useMemo(() => data?.data ?? [], [data?.data]);
  const totalResults = data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(Math.max(totalResults, 1) / rowsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Re-filter columns when user role changes
  useEffect(() => {
    const filteredColumns = filterColumnsByRole(columns, userRole);
    // Only update if there's a difference (some columns were filtered out)
    if (filteredColumns.length !== columns.length) {
      setColumns(filteredColumns);
    }
  }, [userRole]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleApplyFilters = (filters: VehicleFilters) => {
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
      const { blob, fileName } = await exportVehicles(listParams);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showSnackbar({
        message: "Vehicle report exported successfully.",
        severity: "success",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to export vehicles.";
      showSnackbar({ message, severity: "error" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: vehicleQueryKeys.lists() });
  };

  const errorMessage =
    error instanceof Error ? error.message : error ? "Unable to load vehicles." : null;

  return (
    <div className="p-4">
      <div className="rounded-lg bg-white shadow-sm">
        <VehicleTableControls
          selectedDate={selectedDate}
          onDateChange={handleDateChange}
          onSort={handleSortClick}
          onFilter={handleFilterClick}
          onColumns={handleColumnsClick}
          onExport={handleExport}
          exportInProgress={isExporting}
          sortActive={currentSort !== null}
          filterCount={activeFilterCount}
        />
        <VehicleTable
          data={vehicles}
          loading={isLoading || isFetching}
          onRefresh={handleRefresh}
          currentSort={currentSort}
          columns={columns}
        />
        {errorMessage ? <p className="px-4 text-sm text-red-500">{errorMessage}</p> : null}
        <VehicleTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          rowsPerPage={rowsPerPage}
          totalResults={totalResults}
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
        userRole={userRole}
      />
    </div>
  );
}
