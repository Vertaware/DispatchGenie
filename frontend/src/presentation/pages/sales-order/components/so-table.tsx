"use client";

import { Menu, Tooltip } from "@mui/material";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import dayjs from "dayjs";
import Link from "next/link";
import { useState } from "react";
import { IoMdMore } from "react-icons/io";
import { IoArrowDown, IoArrowUp } from "react-icons/io5";
import type { SalesOrder, SalesOrderStatus } from "~/domain/entities/sales-order";
import { formatCurrency, formatFrightCost } from "~/shared/utils/format";
import type { ColumnConfig } from "./columns-popover";
import type { SortConfig } from "./sort-popover";

type SalesOrderTableProps = {
  data: SalesOrder[];
  loading?: boolean;
  selectedRows: Set<string>;
  onSelectAll: (checked: boolean) => void;
  onSelectRow: (id: string) => void;
  currentSort?: SortConfig | null;
  columns: ColumnConfig[];
  onHold?: (order: SalesOrder) => void;
  onDelete?: (order: SalesOrder) => void;
  onReactivate?: (order: SalesOrder) => void;
};

const STATUS_COLORS: Record<SalesOrderStatus, string> = {
  INFORMATION_NEEDED: "bg-amber-500",
  ASSIGN_VEHICLE: "bg-blue-500",
  VEHICLE_ASSIGNED: "bg-teal-500",
  ARRIVED: "bg-emerald-500",
  GATE_IN: "bg-cyan-500",
  LOADING_START: "bg-orange-500",
  LOADING_COMPLETE: "bg-lime-500",
  HOLD: "bg-amber-700",
  DELETED: "bg-slate-400",
  TRIP_INVOICED: "bg-amber-600",
  GATE_OUT: "bg-sky-600",
  IN_JOURNEY: "bg-purple-500",
  COMPLETED: "bg-green-600",
  INVOICED: "bg-indigo-600",
  CANCELLED: "bg-red-600",
};

const HOLD_DELETE_ELIGIBLE_STATUSES: SalesOrderStatus[] = [
  "INFORMATION_NEEDED",
  "ASSIGN_VEHICLE",
  "VEHICLE_ASSIGNED",
  "ARRIVED",
  "GATE_IN",
  "LOADING_START",
  "LOADING_COMPLETE",
];

const isFrozenStatus = (status?: SalesOrderStatus) => status === "HOLD" || status === "DELETED";
const isHoldDeleteAllowed = (status?: SalesOrderStatus) =>
  status ? HOLD_DELETE_ELIGIBLE_STATUSES.includes(status) : false;

export default function SOTable({
  data,
  loading = false,
  selectedRows,
  onSelectAll,
  onSelectRow,
  currentSort,
  columns,
  onHold,
  onDelete,
  onReactivate,
}: SalesOrderTableProps) {
  const [actionContext, setActionContext] = useState<{
    anchorEl: HTMLElement | null;
    order: SalesOrder | null;
  }>({ anchorEl: null, order: null });

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>, order: SalesOrder) => {
    setActionContext({ anchorEl: event.currentTarget, order });
  };

  const handleClose = () => {
    setActionContext({ anchorEl: null, order: null });
  };

  const visibleColumns = columns.filter((col) => col.visible !== false);
  const assignableOrders = data.filter((row) => row.status === "ASSIGN_VEHICLE");
  const isAllAssignableSelected =
    assignableOrders.length > 0 && assignableOrders.every((row) => selectedRows.has(row.id));

  const getColumnWidth = (column: ColumnConfig) => column.width ?? "140px";

  const handleSelectAllChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSelectAll(e.target.checked);
  };

  const renderSortIcon = (field: string) => {
    if (!currentSort || currentSort.field !== field) return null;
    return currentSort.order === "asc" ? (
      <IoArrowUp className="ml-1 inline text-[#6C63FF]" />
    ) : (
      <IoArrowDown className="ml-1 inline text-[#6C63FF]" />
    );
  };

  const handleAction = (action: "edit" | "hold" | "delete" | "activate") => {
    if (!actionContext.order) return;
    const order = actionContext.order;
    switch (action) {
      case "hold":
        onHold?.(order);
        break;
      case "delete":
        onDelete?.(order);
        break;
      case "activate":
        onReactivate?.(order);
        break;
    }
    handleClose();
  };

  const renderActionsCell = (row: SalesOrder) => {
    const isMenuOpen = actionContext.order?.id === row.id && Boolean(actionContext.anchorEl);
    const rowStatus = row.status as SalesOrderStatus;
    const frozen = isFrozenStatus(rowStatus);
    const canHoldDelete = isHoldDeleteAllowed(rowStatus);

    return (
      <div className="flex items-center gap-2">
        <IconButton
          onClick={(event) => handleClick(event, row)}
          className="rounded p-1.5 text-[#6C63FF] transition-colors hover:bg-[#EFF0FE]"
          title="Sales Order Actions"
          aria-label="Sales Order Actions"
        >
          <IoMdMore className="size-5" />
        </IconButton>
        <Menu
          id={`sales-order-actions-menu-${row.id}`}
          anchorEl={actionContext.anchorEl}
          open={isMenuOpen}
          onClose={handleClose}
          slotProps={{
            list: {
              "aria-labelledby": "basic-button",
            },
          }}
        >
          <MenuItem
            disabled={!onReactivate || !isFrozenStatus(rowStatus)}
            onClick={() => handleAction("activate")}
          >
            Activate
          </MenuItem>
          <MenuItem
            disabled={!onHold || !canHoldDelete || frozen}
            onClick={() => handleAction("hold")}
          >
            Hold
          </MenuItem>
          <MenuItem
            disabled={!onDelete || !canHoldDelete || frozen}
            onClick={() => handleAction("delete")}
          >
            Delete
          </MenuItem>
        </Menu>
      </div>
    );
  };

  const getPinClasses = (columnKey: string, isHeader = false) => {
    const baseZ = isHeader ? "z-40" : "z-20";
    const baseBg = isHeader ? "bg-[#eff0fe]" : "bg-white";
    const top = isHeader ? "top-0" : "";

    switch (columnKey) {
      case "soNumber":
        return `sticky left-0 ${top} ${baseZ} ${baseBg} shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]`;
      case "actions":
        return `sticky right-0 ${top} ${baseZ} ${baseBg} shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.08)]`;
      default:
        return "";
    }
  };

  const getPinStyle = (columnKey: string) => {
    if (columnKey === "soNumber") {
      return { left: "-8px" }; // match container horizontal padding (px-2)
    }
    if (columnKey === "actions") {
      return { right: "-8px" }; // match container horizontal padding (px-2)
    }
    return undefined;
  };

  const renderCell = (column: ColumnConfig, row: SalesOrder) => {
    const isEditable = row.status === "HOLD" || row.status === "DELETED";

    switch (column.key) {
      case "soNumber": {
        const isAssignable = row.status === "ASSIGN_VEHICLE";
        const isSelected = selectedRows.has(row.id);
        return (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => {
                if (isAssignable) {
                  onSelectRow(row.id);
                }
              }}
              disabled={!isAssignable}
              className="size-4 rounded border-gray-300 text-[#6C63FF] focus:ring-[#6C63FF] disabled:cursor-not-allowed disabled:opacity-50"
            />
            {!isEditable ? (
              <Link
                href={`/sales-orders/${row.id}`}
                className="font-medium text-[#6C63FF] hover:underline"
              >
                {row.soNumber}
              </Link>
            ) : (
              <span className="font-medium text-gray-700">{row.soNumber}</span>
            )}
          </div>
        );
      }
      case "soDate":
        return (
          <div className="text-sm text-gray-700">
            {dayjs(row.soDate).format("DD/MM/YYYY HH:mm")}
          </div>
        );
      case "status":
        return (
          <div className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
            <span
              className={`size-2 rounded-full ${STATUS_COLORS[row.status as SalesOrderStatus] ?? "bg-gray-400"}`}
            />
            {row.status.replace(/_/g, " ")}
          </div>
        );
      case "actions":
        return renderActionsCell(row);
      case "frightCost": {
        const value = row.frightCost;
        const formatted = <span className="text-sm text-gray-700">{formatFrightCost(value)}</span>;
        return (
          <div className="w-full truncate text-sm text-gray-700">
            <Tooltip title={formatted}>{formatted}</Tooltip>
          </div>
        );
      }
      case "profit": {
        const value = row.profit;
        const formatted = <span className="text-sm text-gray-700">{formatCurrency(value)}</span>;
        return (
          <div className="w-full truncate text-sm text-gray-700">
            <Tooltip title={formatted}>{formatted}</Tooltip>
          </div>
        );
      }
      case "articleDescription": {
        // Display articles array if available, otherwise fallback to articleDescription
        const articles = row.articles;
        if (articles && Array.isArray(articles) && articles.length > 0) {
          const descriptions = articles
            .map((a) => a.articleDescription || "—")
            .filter((d) => d !== "—");
          const displayText = descriptions.length > 0 ? descriptions.join(", ") : "—";
          return (
            <div className="w-full truncate text-sm text-gray-700">
              <Tooltip title={displayText}>
                <span>{displayText}</span>
              </Tooltip>
            </div>
          );
        }
        const value = row.articleDescription;
        return (
          <div className="w-full truncate text-sm text-gray-700">
            <Tooltip title={value ?? "—"}>{value ?? "—"}</Tooltip>
          </div>
        );
      }
      default: {
        const value = row[column.key as keyof SalesOrder] as any;
        return (
          <div className="w-full truncate text-sm text-gray-700">
            <Tooltip title={value ?? "—"}>{value ?? "—"}</Tooltip>
          </div>
        );
      }
    }
  };

  const renderRows = () => {
    const colSpan = visibleColumns.length;

    if (loading) {
      return (
        <tr>
          <td colSpan={colSpan} className="px-4 py-10">
            <div className="flex min-h-[calc(100vh-27rem)] items-center justify-center">
              <div className="size-16 animate-spin rounded-full border-8 border-gray-300 border-t-gray-700" />
            </div>
          </td>
        </tr>
      );
    }

    if (data.length === 0) {
      return (
        <tr>
          <td colSpan={colSpan} className="px-4 py-8 text-center text-sm text-gray-500">
            No sales orders found for the selected filters.
          </td>
        </tr>
      );
    }

    return (
      <>
        {data.map((row) => (
          <tr key={row.id} className="group border-b border-gray-100">
            {visibleColumns.map((column) => {
              const width = getColumnWidth(column);
              return (
                <td
                  key={column.key}
                  className={`${getPinClasses(column.key)} bg-white px-4 py-3 transition-colors group-hover:bg-gray-50`}
                  style={{ ...getPinStyle(column.key), width, maxWidth: width }}
                >
                  {renderCell(column, row)}
                </td>
              );
            })}
          </tr>
        ))}
      </>
    );
  };

  const renderHeader = () => {
    return visibleColumns.map((column, index) => {
      const isFirst = index === 0;
      const isLast = index === visibleColumns.length - 1;

      const width = getColumnWidth(column);

      return (
        <th
          key={column.key}
          className={`sticky top-0 ${getPinClasses(column.key, true)} px-4 py-3 text-left text-sm font-semibold text-gray-900 ${
            isFirst ? "rounded-l-lg" : ""
          } ${isLast ? "rounded-r-lg" : ""}`}
          style={{ ...getPinStyle(column.key), width, minWidth: width }}
        >
          {column.key === "soNumber" ? (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isAllAssignableSelected}
                onChange={handleSelectAllChange}
                className="size-4 rounded border-gray-300 text-[#6C63FF] focus:ring-[#6C63FF]"
                disabled={loading || assignableOrders.length === 0}
              />
              <span>{column.label}</span>
            </div>
          ) : (
            <span>
              {column.label}
              {column.sortField && renderSortIcon(column.sortField)}
            </span>
          )}
        </th>
      );
    });
  };

  return (
    <div className="relative isolate h-[calc(100vh-14rem)] overflow-auto rounded-lg bg-white px-2 shadow-sm">
      <table className="relative w-full min-w-[1400px] border-separate border-spacing-0">
        <thead className="sticky top-0 z-30 bg-[#eff0fe] shadow-sm">
          <tr className="bg-[#eff0fe]">{renderHeader()}</tr>
        </thead>
        <tbody>{renderRows()}</tbody>
      </table>
    </div>
  );
}
