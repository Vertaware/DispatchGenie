"use client";

import dayjs from "dayjs";
import { Fragment } from "react";
import { IoArrowDown, IoArrowUp } from "react-icons/io5";
import type { Invoice } from "~/domain/entities/invoice";
import { formatCurrency, formatFrightCost } from "~/shared/utils/format";
import type { ColumnConfig } from "./columns-popover";
import type { SortConfig } from "./sort-popover";

type InvoiceTableProps = {
  data: Invoice[];
  loading?: boolean;
  currentSort?: SortConfig | null;
  columns: ColumnConfig[];
  onMarkPaid?: (invoiceId: string) => void;
};

export default function InvoiceTable({
  data,
  loading = false,
  currentSort,
  columns,
  onMarkPaid,
}: InvoiceTableProps) {
  const visibleColumns = columns.filter((col) => col.visible !== false);

  const renderSortIcon = (field: string) => {
    if (!currentSort || currentSort.field !== field) return null;
    return currentSort.order === "asc" ? (
      <IoArrowUp className="ml-1 inline text-[#6C63FF]" />
    ) : (
      <IoArrowDown className="ml-1 inline text-[#6C63FF]" />
    );
  };

  const renderCell = (column: ColumnConfig, invoice: Invoice) => {
    switch (column.key) {
      case "invoiceNumber":
        return (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[#6C63FF]">{invoice.invoiceNumber}</span>
          </div>
        );
      case "date":
        return (
          <span className="text-sm text-gray-700">
            {invoice.date ? dayjs(invoice.date).format("DD/MM/YYYY") : "—"}
          </span>
        );
      case "status":
        return (
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
              invoice.status === "PAID"
                ? "bg-[#E8F5E9] text-[#2E7D32]"
                : "bg-[#FFF3E0] text-[#F57C00]"
            }`}
          >
            ● {invoice.status === "PAID" ? "Paid" : "Draft"}
          </span>
        );
      case "vehicleNumber":
        return <span className="text-sm text-gray-700">{invoice.vehicleNumber ?? "—"}</span>;
      case "driverPhone":
        return <span className="text-sm text-gray-700">{invoice.driverPhone ?? "—"}</span>;
      case "vehicleAmount":
        return (
          <span className="text-sm font-medium text-gray-700">
            {formatCurrency(invoice.vehicleAmount)}
          </span>
        );
      case "locationReachedAt":
        return (
          <span className="text-sm text-gray-700">
            {invoice.locationReachedAt
              ? dayjs(invoice.locationReachedAt).format("DD/MM/YYYY HH:mm")
              : "—"}
          </span>
        );
      case "unloadedDate":
        return (
          <span className="text-sm text-gray-700">
            {invoice.unloadedDate ? dayjs(invoice.unloadedDate).format("DD/MM/YYYY HH:mm") : "—"}
          </span>
        );
      case "dbWaitingTime":
        return (
          <span className="text-sm text-gray-700">
            {invoice.dbWaitingTime !== null && invoice.dbWaitingTime !== undefined
              ? `${invoice.dbWaitingTime.toFixed(2)} hrs`
              : "—"}
          </span>
        );
      case "frightCost":
        return (
          <span className="text-sm text-gray-700">{formatFrightCost(invoice.frightCost)}</span>
        );
      case "unloadingCharge":
        return (
          <span className="text-sm text-gray-700">{formatCurrency(invoice.unloadingCharge)}</span>
        );
      case "detentionCharge":
        return (
          <span className="text-sm text-gray-700">{formatCurrency(invoice.detentionCharge)}</span>
        );
      case "otherExpense":
        return (
          <span className="text-sm text-gray-700">{formatCurrency(invoice.otherExpense)}</span>
        );
      case "totalExpense":
        return (
          <span className="text-sm font-medium text-gray-700">
            {formatCurrency(invoice.totalExpense)}
          </span>
        );
      case "profit":
        return (
          <span className="text-sm font-medium text-green-600">
            {formatCurrency(invoice.profit)}
          </span>
        );
      // Legacy fields for backward compatibility
      case "invoiceAmount":
        return (
          <span className="text-sm font-medium text-gray-700">
            {formatCurrency(invoice.invoiceAmount)}
          </span>
        );
      case "paidDate":
        return (
          <span className="text-sm text-gray-700">
            {invoice.paidDate ? dayjs(invoice.paidDate).format("DD/MM/YYYY") : "—"}
          </span>
        );
      case "paidAmount":
        return <span className="text-sm text-gray-700">{formatCurrency(invoice.paidAmount)}</span>;
      case "totalProfit":
        return (
          <span className="text-sm font-medium text-green-600">
            {formatCurrency(invoice.totalProfit)}
          </span>
        );
      default:
        return <span>—</span>;
    }
  };

  const renderHeader = () => {
    return (
      <>
        {visibleColumns.map((column, index) => {
          const isFirst = index === 0;
          return (
            <th
              key={column.key}
              className={`px-4 py-3 text-left text-sm font-semibold text-gray-900 ${
                isFirst ? "rounded-l-lg" : ""
              }`}
            >
              {column.key === "invoiceNumber" ? (
                <div className="flex items-center gap-2">
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
        })}
        <th className="rounded-r-lg px-4 py-3 text-left text-sm font-semibold text-gray-900">
          Actions
        </th>
      </>
    );
  };

  const renderRows = () => {
    const colSpan = visibleColumns.length + 1; // +1 for Actions column

    if (loading) {
      return (
        <tr>
          <td colSpan={colSpan} className="px-4 py-6 text-center text-sm text-gray-500">
            Loading invoices...
          </td>
        </tr>
      );
    }

    if (data.length === 0) {
      return (
        <tr>
          <td colSpan={colSpan} className="px-4 py-6 text-center text-sm text-gray-500">
            No invoices found.
          </td>
        </tr>
      );
    }

    return data.map((invoice) => {
      return (
        <Fragment key={invoice.id}>
          <tr className="border-b border-gray-100 hover:bg-gray-50">
            {visibleColumns.map((column) => (
              <td key={column.key} className="px-4 py-3">
                {renderCell(column, invoice)}
              </td>
            ))}
            <td className="px-4 py-3 text-right">
              <div className="flex items-center justify-end gap-2">
                {invoice.status === "DRAFT" && onMarkPaid && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onMarkPaid(invoice.id);
                    }}
                    className="inline-flex items-center gap-1 rounded-full bg-green-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-green-700"
                  >
                    Complete
                  </button>
                )}
              </div>
            </td>
          </tr>
        </Fragment>
      );
    });
  };

  return (
    <div className="h-[calc(100vh-14rem)] overflow-auto px-2">
      <table className="w-full min-w-full">
        <thead className="sticky top-0 z-10">
          <tr className="bg-[#eff0fe]">{renderHeader()}</tr>
        </thead>
        <tbody>{renderRows()}</tbody>
      </table>
    </div>
  );
}
