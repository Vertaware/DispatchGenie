"use client";

import dayjs from "dayjs";
import { useSession } from "next-auth/react";
import { Fragment, useState } from "react";
import { IoArrowDown, IoArrowUp, IoChevronDown, IoChevronUp } from "react-icons/io5";
import { getBeneficiary } from "~/infrastructure/services/beneficiary.service";
import { getDocumentViewerUrl } from "~/infrastructure/services/document.service";
import type {
  BankTransaction,
  BankTransactionWithDetails,
} from "~/infrastructure/services/transaction.service";
import { getBankTransaction } from "~/infrastructure/services/transaction.service";
import { useSnackbar } from "~/shared/contexts";
import type { ColumnConfig } from "./columns-popover";
import type { SortConfig } from "./sort-popover";

type TransactionsTableProps = {
  data: BankTransaction[];
  loading?: boolean;
  selectedRows: Set<string>;
  onSelectAll: (checked: boolean) => void;
  onSelectRow: (transactionId: string) => void;
  currentSort?: SortConfig | null;
  columns: ColumnConfig[];
};

const formatCurrency = (amount?: number) =>
  typeof amount === "number" ? `₹${amount.toLocaleString("en-IN")}` : "—";

export default function TransactionsTable({
  data,
  loading = false,
  currentSort,
  columns,
}: TransactionsTableProps) {
  const visibleColumns = columns.filter((col) => col.visible !== false);
  const { showSnackbar } = useSnackbar();
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [detailsCache, setDetailsCache] = useState<
    Record<string, BankTransactionWithDetails | null>
  >({});
  const [detailLoading, setDetailLoading] = useState<Record<string, boolean>>({});
  const [beneficiaries, setBeneficiaries] = useState<
    Record<string, { name: string; accountNumber: string }>
  >({});
  const [beneficiaryLoading, setBeneficiaryLoading] = useState<Record<string, boolean>>({});
  const { data: session }: any = useSession();
  const renderSortIcon = (field: string) => {
    if (!currentSort || currentSort.field !== field) return null;
    return currentSort.order === "asc" ? (
      <IoArrowUp className="ml-1 inline text-[#6C63FF]" />
    ) : (
      <IoArrowDown className="ml-1 inline text-[#6C63FF]" />
    );
  };

  const loadBeneficiaryName = async (id?: string) => {
    if (!id || beneficiaries[id] || beneficiaryLoading[id]) return;
    setBeneficiaryLoading((prev) => ({ ...prev, [id]: true }));
    try {
      const beneficiary = await getBeneficiary(id);
      setBeneficiaries((prev) => ({
        ...prev,
        [id]: { name: beneficiary.name, accountNumber: beneficiary.accountNumber },
      }));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Failed to load beneficiary ${id}`, error);
    } finally {
      setBeneficiaryLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  const renderCell = (
    column: ColumnConfig,
    transaction: BankTransaction,
    detail: BankTransactionWithDetails | null | undefined,
    isExpanded: boolean,
  ) => {
    switch (column.key) {
      case "transactionCode":
        return (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleToggleRow(transaction.id)}
              className="rounded-full border border-gray-300 p-1 transition-colors hover:bg-gray-100"
              disabled={detailLoading[transaction.id]}
            >
              {detailLoading[transaction.id] ? (
                <div className="size-4 animate-spin rounded-full border-2 border-[#6C63FF] border-t-transparent" />
              ) : isExpanded ? (
                <IoChevronUp />
              ) : (
                <IoChevronDown />
              )}
            </button>
            <div className="text-sm font-medium text-gray-900">{transaction.transactionCode}</div>
          </div>
        );
      case "transactionDate":
        return (
          <span className="text-sm font-medium text-gray-700">
            {dayjs(transaction.transactionDate).format("DD/MM/YYYY")}
          </span>
        );
      case "totalPaidAmount":
        return (
          <span className="text-sm font-medium text-gray-700">
            {formatCurrency(transaction.totalPaidAmount)}
          </span>
        );
      case "beneficiaryName":
        void loadBeneficiaryName(transaction.beneficiaryId);
        return (
          <span className="text-sm text-gray-500">
            {beneficiaries[transaction.beneficiaryId]?.name || "—"}
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
              <span>
                {column.label}
                {column.sortField && renderSortIcon(column.sortField)}
              </span>
            </th>
          );
        })}
        <th className="rounded-r-lg px-4 py-3 text-left text-sm font-semibold text-gray-900">
          Payment Document
        </th>
      </>
    );
  };

  const handleToggleRow = async (id: string) => {
    const isCurrentlyExpanded = expandedRows[id];
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));

    // If closing the row or data already cached, just toggle
    if (isCurrentlyExpanded || detailsCache[id] || detailLoading[id]) {
      return;
    }

    // Fetch transaction details when opening for the first time
    setDetailLoading((prev) => ({ ...prev, [id]: true }));
    try {
      const detail = await getBankTransaction(id);
      setDetailsCache((prev) => ({ ...prev, [id]: detail }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load transaction details.";
      showSnackbar({ message, severity: "error" });
      setExpandedRows((prev) => ({ ...prev, [id]: false }));
    } finally {
      setDetailLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  const renderDetailRow = (id: string) => {
    if (detailLoading[id]) {
      return <div className="px-6 py-4 text-sm text-gray-500">Loading transaction details...</div>;
    }
    const detail = detailsCache[id];
    if (!detail) {
      return (
        <div className="px-6 py-4 text-sm text-gray-500">
          No additional detail available for this transaction.
        </div>
      );
    }

    const { allocations } = detail;

    if (!allocations || allocations.length === 0) {
      return (
        <div className="px-6 py-4 text-sm text-gray-500">
          No payment allocations found for this transaction.
        </div>
      );
    }

    return (
      <div className="px-4 pb-4">
        {allocations.map((allocation, index) => {
          const salesOrder = allocation.paymentRequest?.salesOrder;
          const vehicle = allocation.paymentRequest?.vehicle;

          return (
            <div
              key={allocation.id}
              className={`grid grid-cols-4 gap-4 px-4 py-3 text-sm ${
                index % 2 === 0 ? "bg-white" : "bg-gray-50"
              }`}
            >
              <div className="flex flex-col gap-1">
                <span className="text-xs text-gray-500">SO No</span>
                <span className="font-medium text-[#6C63FF]">{salesOrder?.soNumber || "—"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-gray-500">SO Date</span>
                <span className="text-gray-700">
                  {salesOrder?.soDate ? dayjs(salesOrder.soDate).format("DD/MM/YYYY") : "—"}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-gray-500">Vehicle Number</span>
                <span className="font-medium text-[#6C63FF]">{vehicle?.vehicleNumber || "—"}</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const fetchDocument = async (url: string) => {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/pdf",
        Authorization: `Bearer ${session?.user?.token}`,
      },
    });
    return response.blob();
  };

  const handleViewDocument = async (documentId: string) => {
    try {
      const { url } = await getDocumentViewerUrl(documentId);
      const blob = await fetchDocument(url);
      const newWindow = window.open(URL.createObjectURL(blob), "_blank", "noopener,noreferrer");
      if (newWindow) {
        newWindow.document.title = "Payment Document";
      } else {
        showSnackbar({ message: "Unable to open document.", severity: "error" });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to open document.";
      showSnackbar({ message, severity: "error" });
    }
  };

  const renderRows = () => {
    const colSpan = visibleColumns.length + 1; // +1 for Payment Document column

    if (loading) {
      return (
        <tr>
          <td colSpan={colSpan} className="px-4 py-6 text-center text-sm text-gray-500">
            Loading transactions...
          </td>
        </tr>
      );
    }

    if (data.length === 0) {
      return (
        <tr>
          <td colSpan={colSpan} className="px-4 py-6 text-center text-sm text-gray-500">
            No transactions found.
          </td>
        </tr>
      );
    }

    return data.map((transaction) => {
      const isExpanded = Boolean(expandedRows[transaction.id]);
      const detail = detailsCache[transaction.id];

      return (
        <Fragment key={transaction.id}>
          <tr className="border-b border-gray-100 hover:bg-gray-50">
            {visibleColumns.map((column) => (
              <td key={column.key} className="px-4 py-3">
                {renderCell(column, transaction, detail, isExpanded)}
              </td>
            ))}
            <td className="px-4 py-3">
              <button
                className="inline-flex items-center gap-1 text-sm text-[#6C63FF] hover:underline"
                onClick={() => {
                  handleViewDocument(transaction.paymentDocumentId);
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="size-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                  />
                </svg>
                View Document
              </button>
            </td>
          </tr>
          {isExpanded ? (
            <tr className="border-b border-gray-100 bg-gray-50">
              <td colSpan={colSpan}>{renderDetailRow(transaction.id)}</td>
            </tr>
          ) : null}
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
