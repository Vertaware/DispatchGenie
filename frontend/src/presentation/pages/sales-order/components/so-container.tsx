"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import type { SalesOrder } from "~/domain/entities/sales-order";
import { UserRole } from "~/domain/enums/enum";
import {
  deleteSalesOrder,
  exportSalesOrders,
  holdSalesOrder,
  reactivateSalesOrder,
  type ListSalesOrdersParams,
  type SalesOrderFilters,
} from "~/infrastructure/services/sales-order.service";
import useAuth from "~/presentation/hooks/useAuth";
import { salesOrderQueryKeys, useSalesOrders } from "~/presentation/hooks/useSalesOrders";
import { useSnackbar } from "~/shared/contexts";
import AssignVehicleModal from "./assign-vehicle-modal";
import ColumnsPopover, {
  DEFAULT_COLUMNS,
  filterColumnsByRole,
  type ColumnConfig,
} from "./columns-popover";
import FilterPanel from "./filter-panel";
import SalesOrderTable from "./so-table";
import TableControls from "./so-table-controls";
import TablePagination from "./so-table-pagination";
import SortPopover, { type SortConfig } from "./sort-popover";

export default function SOContainer() {
  const queryClient = useQueryClient();
  const { showSnackbar } = useSnackbar();
  const { session } = useAuth();
  const userRole = (session?.user as any)?.user?.role as UserRole | undefined;
  const [selectedDate, setSelectedDate] = useState<"today" | "yesterday" | "all">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [isAssignModalOpen, setAssignModalOpen] = useState(false);

  // Sort state
  const [sortAnchorEl, setSortAnchorEl] = useState<HTMLElement | null>(null);
  const [currentSort, setCurrentSort] = useState<SortConfig | null>(null);

  // Filter state
  const [filterAnchorEl, setFilterAnchorEl] = useState<HTMLElement | null>(null);
  const [additionalFilters, setAdditionalFilters] = useState<SalesOrderFilters>({});

  // Columns state - filter by role on initialization
  const [columnsAnchorEl, setColumnsAnchorEl] = useState<HTMLElement | null>(null);
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    // Filter columns based on user role
    const filteredDefaultCols = filterColumnsByRole(DEFAULT_COLUMNS, userRole);
    const defaultCols = filteredDefaultCols.map((col) => ({
      ...col,
      visible: true,
    }));
    // Add actions column
    defaultCols.push({
      key: "actions",
      label: "Actions",
      alwaysVisible: false,
      visible: true,
      width: "80px",
    });
    return defaultCols;
  });

  const holdMutation = useMutation({
    mutationFn: (orderId: string) => holdSalesOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: salesOrderQueryKeys.all });
      showSnackbar({ message: "Sales order moved to Hold.", severity: "success" });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Unable to hold sales order.";
      showSnackbar({ message, severity: "error" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (orderId: string) => deleteSalesOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: salesOrderQueryKeys.all });
      showSnackbar({ message: "Sales order deleted.", severity: "success" });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Unable to delete sales order.";
      showSnackbar({ message, severity: "error" });
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: (orderId: string) => reactivateSalesOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: salesOrderQueryKeys.all });
      showSnackbar({ message: "Sales order reactivated.", severity: "success" });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Unable to reactivate sales order.";
      showSnackbar({ message, severity: "error" });
    },
  });

  const filters = useMemo(() => {
    const baseFilters: SalesOrderFilters = { ...additionalFilters };

    if (selectedDate !== "all") {
      const baseDate = selectedDate === "today" ? dayjs() : dayjs().subtract(1, "day");
      baseFilters.fromDate = baseDate.startOf("day").toISOString();
      baseFilters.toDate = baseDate.endOf("day").toISOString();
    }

    return baseFilters;
  }, [selectedDate, additionalFilters]);

  const listParams = useMemo<ListSalesOrdersParams>(
    () => ({
      page: currentPage,
      pageSize: rowsPerPage,
      sortBy: currentSort?.field,
      sortOrder: currentSort?.order,
      filters,
    }),
    [currentPage, rowsPerPage, currentSort, filters],
  );

  const { data, isLoading, isFetching, error } = useSalesOrders(listParams);
  const salesOrders = useMemo(() => data?.data ?? [], [data?.data]);
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

  // Check if order is eligible for vehicle assignment
  const isEligibleForAssignment = (status: string) => status === "ASSIGN_VEHICLE";

  useEffect(() => {
    setSelectedRows((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set<string>();
      salesOrders.forEach((order) => {
        // Only keep eligible orders in selection
        if (prev.has(order.id) && isEligibleForAssignment(order.status)) {
          next.add(order.id);
        }
      });
      if (next.size === prev.size) {
        return prev;
      }
      return next;
    });
  }, [salesOrders]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Only select orders eligible for assignment
      const eligibleOrderIds = salesOrders
        .filter((row) => isEligibleForAssignment(row.status))
        .map((row) => row.id);
      setSelectedRows(new Set(eligibleOrderIds));
    } else {
      setSelectedRows(new Set());
    }
  };

  const handleSelectRow = (id: string) => {
    const order = salesOrders.find((o) => o.id === id);
    // Only allow selection of eligible orders
    if (order && !isEligibleForAssignment(order.status)) {
      return;
    }
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

  const handleApplyFilters = (filters: SalesOrderFilters) => {
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
    // Filter columns based on user role when columns change
    const filteredColumns = filterColumnsByRole(newColumns, userRole);
    setColumns(filteredColumns);
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
      const { blob, fileName } = await exportSalesOrders(listParams);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showSnackbar({
        message: "Export generated successfully.",
        severity: "success",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to export sales orders.";
      showSnackbar({ message, severity: "error" });
    } finally {
      setIsExporting(false);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const selectedOrders: SalesOrder[] = useMemo(
    () =>
      salesOrders.filter(
        (order) => selectedRows.has(order.id) && isEligibleForAssignment(order.status),
      ),
    [salesOrders, selectedRows],
  );

  const handleAssignVehicleClick = () => {
    const eligibleSelected = salesOrders.filter(
      (order) => selectedRows.has(order.id) && isEligibleForAssignment(order.status),
    );

    if (eligibleSelected.length === 0) {
      const hasNonEligibleSelected = salesOrders.some(
        (order) => selectedRows.has(order.id) && !isEligibleForAssignment(order.status),
      );
      if (hasNonEligibleSelected) {
        showSnackbar({
          message:
            "Only orders with ASSIGN_VEHICLE or INFORMATION_NEEDED status can be assigned a vehicle. Please select eligible orders only.",
          severity: "warning",
        });
      } else {
        showSnackbar({
          message:
            "Select at least one sales order with ASSIGN_VEHICLE or INFORMATION_NEEDED status to assign a vehicle.",
          severity: "warning",
        });
      }
      return;
    }
    setAssignModalOpen(true);
  };

  const handleAssignmentSuccess = () => {
    setAssignModalOpen(false);
    setSelectedRows(new Set());
  };

  const handleRemoveOrderFromSelection = (orderId: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      next.delete(orderId);
      return next;
    });
  };

  const handleHoldOrder = async (order: SalesOrder) => {
    try {
      await holdMutation.mutateAsync(order.id);
    } catch {
      // Error handled in mutation onError
    }
  };

  const handleDeleteOrder = async (order: SalesOrder) => {
    try {
      await deleteMutation.mutateAsync(order.id);
    } catch {
      // Error handled in mutation onError
    }
  };

  const handleReactivateOrder = async (order: SalesOrder) => {
    try {
      await reactivateMutation.mutateAsync(order.id);
    } catch {
      // Error handled in mutation onError
    }
  };

  const errorMessage =
    error instanceof Error ? error.message : error ? "Unable to load sales orders." : null;

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
          onAssignVehicle={handleAssignVehicleClick}
          exportInProgress={isExporting}
          sortActive={currentSort !== null}
          filterCount={activeFilterCount}
        />
        <SalesOrderTable
          data={salesOrders}
          loading={isLoading || isFetching}
          selectedRows={selectedRows}
          onSelectAll={handleSelectAll}
          onSelectRow={handleSelectRow}
          currentSort={currentSort}
          columns={columns}
          onHold={handleHoldOrder}
          onDelete={handleDeleteOrder}
          onReactivate={handleReactivateOrder}
        />
        {errorMessage ? <p className="px-4 text-sm text-red-500">{errorMessage}</p> : null}
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          rowsPerPage={rowsPerPage}
          totalResults={totalResults}
          onPageChange={handlePageChange}
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

      {/* Assign Vehicle Modal */}
      <AssignVehicleModal
        open={isAssignModalOpen}
        orders={selectedOrders}
        onClose={() => setAssignModalOpen(false)}
        onRemoveOrder={handleRemoveOrderFromSelection}
        onAssigned={handleAssignmentSuccess}
      />
    </div>
  );
}
