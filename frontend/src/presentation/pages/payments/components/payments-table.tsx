"use client";

import dayjs from "dayjs";
import { Fragment, useState } from "react";
import { IoArrowDown, IoArrowUp } from "react-icons/io5";
import type { PaymentRequest } from "~/domain/entities/payment";
import { getBeneficiary } from "~/infrastructure/services/beneficiary.service";
import type { ColumnConfig } from "./columns-popover";
import CompletePaymentModal from "./complete-payment-modal";
import type { SortConfig } from "./sort-popover";

type PaymentsTableProps = {
  data: PaymentRequest[];
  loading?: boolean;
  selectedRows: Set<string>;
  onSelectAll: (checked: boolean) => void;
  onSelectRow: (id: string) => void;
  currentSort?: SortConfig | null;
  columns: ColumnConfig[];
};

const formatCurrency = (amount?: number) =>
  typeof amount === "number" ? `₹${amount.toLocaleString("en-IN")}` : "—";

export default function PaymentsTable({
  data,
  loading = false,
  currentSort,
  columns,
}: PaymentsTableProps) {
  const visibleColumns = columns.filter(
    (col) => col.visible !== false && col.key !== "finalAmount",
  );
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [beneficiaries, setBeneficiaries] = useState<Record<string, string>>({});
  const [beneficiaryLoading, setBeneficiaryLoading] = useState<Record<string, boolean>>({});

  const transactionTypeLabels: Record<PaymentRequest["transactionType"], string> = {
    ADVANCE_SHIPPING: "Advance Shipping",
    BALANCE_SHIPPING: "Balance Shipping",
    FULL_SHIPPING_CHARGES: "Full Shipping Charges",
    POINT_1_TO_POINT_2_TRANSFER: "Point 1 to Point 2 Transfer",
    UNLOADING_CHARGE: "Unloading Charge",
    UNLOADING_DETENTION: "Unloading Detention",
    MISCELLANEOUS_CHARGES: "Miscellaneous Charges",
  };

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
      setBeneficiaries((prev) => ({ ...prev, [id]: beneficiary.name }));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Failed to load beneficiary ${id}`, error);
    } finally {
      setBeneficiaryLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  const renderCell = (column: ColumnConfig, payment: PaymentRequest) => {
    switch (column.key) {
      case "soNumber":
        return (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[#6C63FF]">{payment.soNumber}</span>
          </div>
        );
      case "paymentDate":
        return (
          <span className="text-sm text-gray-700">
            {payment.paymentDate ? dayjs(payment.paymentDate).format("DD/MM/YYYY") : "—"}
          </span>
        );
      case "transactionType":
        return (
          <span className="inline-flex items-center rounded-full bg-[#EEF0FF] px-3 py-1 text-xs font-medium text-[#6C63FF]">
            ● {transactionTypeLabels[payment.transactionType] ?? payment.transactionType}
          </span>
        );
      case "requestedAmount":
        return (
          <span className="text-sm text-gray-700">{formatCurrency(payment.requestedAmount)}</span>
        );
      case "beneficiaryName":
        void loadBeneficiaryName(payment.beneficiaryId);
        return (
          <span className="text-sm text-gray-500">
            {beneficiaries[payment.beneficiaryId] ??
              (beneficiaryLoading[payment.beneficiaryId] ? "Loading..." : "--")}
          </span>
        );
      case "status":
        return (
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
              payment.status === "PENDING"
                ? "bg-[#FFF3E0] text-[#F57C00]"
                : "bg-[#E8F5E9] text-[#2E7D32]"
            }`}
          >
            ● {payment.status === "PENDING" ? "Payment pending" : "Completed"}
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
              {column.key === "soNumber" ? (
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
            Loading payment requests...
          </td>
        </tr>
      );
    }

    if (data.length === 0) {
      return (
        <tr>
          <td colSpan={colSpan} className="px-4 py-6 text-center text-sm text-gray-500">
            No payment requests found.
          </td>
        </tr>
      );
    }

    return data.map((payment) => {
      return (
        <Fragment key={payment.id}>
          <tr className="border-b border-gray-100 hover:bg-gray-50">
            {visibleColumns.map((column) => (
              <td key={column.key} className="px-4 py-3">
                {renderCell(column, payment)}
              </td>
            ))}
            <td className="px-4 py-3 text-right">
              {payment.status !== "COMPLETED" && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedPaymentId(payment.id);
                    setCompleteModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1 rounded-full bg-[#10B981] px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#059669]"
                >
                  Complete
                  <span className="text-lg">→</span>
                </button>
              )}
            </td>
          </tr>
        </Fragment>
      );
    });
  };

  return (
    <>
      <div className="h-[calc(100vh-14rem)] overflow-auto px-2">
        <table className="w-full min-w-full">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#eff0fe]">{renderHeader()}</tr>
          </thead>
          <tbody>{renderRows()}</tbody>
        </table>
      </div>

      <CompletePaymentModal
        open={completeModalOpen}
        onClose={() => {
          setCompleteModalOpen(false);
          setSelectedPaymentId(null);
        }}
        paymentRequestId={selectedPaymentId || undefined}
      />
    </>
  );
}
