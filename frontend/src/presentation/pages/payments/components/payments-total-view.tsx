"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PaymentRequest } from "~/domain/entities/payment";
import { getBeneficiary } from "~/infrastructure/services/beneficiary.service";
import type { TotalViewFilters } from "./total-view-filter-panel";
import type { TotalViewSortConfig } from "./total-view-sort-popover";

type PaymentsTotalViewProps = {
  payments: PaymentRequest[];
  sortConfig: TotalViewSortConfig | null;
  filters: TotalViewFilters;
};

type AggregatedPayment = {
  beneficiaryId: string;
  beneficiaryName: string;
  status: PaymentRequest["status"];
  totalAmount: number;
};

const formatCurrency = (amount: number) => {
  return `₹${amount.toLocaleString("en-IN")}`;
};

export default function PaymentsTotalView({
  payments,
  sortConfig,
  filters,
}: PaymentsTotalViewProps) {
  const [beneficiaries, setBeneficiaries] = useState<Record<string, string>>({});
  const [beneficiaryLoading, setBeneficiaryLoading] = useState<Set<string>>(new Set());
  const fetchedRef = useRef<Set<string>>(new Set());

  // Fetch beneficiary names for all unique beneficiary IDs
  useEffect(() => {
    const uniqueBeneficiaryIds = Array.from(
      new Set(payments.map((p) => p.beneficiaryId).filter(Boolean)),
    );

    uniqueBeneficiaryIds.forEach((id) => {
      // Skip if already fetched (tracked by ref)
      if (fetchedRef.current.has(id)) {
        return;
      }

      // Mark as fetching
      fetchedRef.current.add(id);
      setBeneficiaryLoading((prev) => new Set(prev).add(id));

      // Fetch beneficiary
      getBeneficiary(id)
        .then((beneficiary) => {
          setBeneficiaries((prev) => {
            if (prev[id]) return prev; // Avoid overwriting if already set
            return { ...prev, [id]: beneficiary.name };
          });
        })
        .catch((error) => {
          // eslint-disable-next-line no-console
          console.error(`Failed to load beneficiary ${id}`, error);
          setBeneficiaries((prev) => {
            if (prev[id]) return prev;
            return { ...prev, [id]: "Unknown" };
          });
        })
        .finally(() => {
          setBeneficiaryLoading((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        });
    });
  }, [payments]);

  // Aggregate payments by beneficiary and status
  const aggregatedPayments = useMemo(() => {
    const grouped = new Map<string, AggregatedPayment>();

    payments.forEach((payment) => {
      const beneficiaryName =
        beneficiaries[payment.beneficiaryId] ||
        (beneficiaryLoading.has(payment.beneficiaryId) ? "Loading..." : "--");
      const key = `${payment.beneficiaryId}-${payment.status}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          beneficiaryId: payment.beneficiaryId,
          beneficiaryName,
          status: payment.status,
          totalAmount: 0,
        });
      }

      const existing = grouped.get(key)!;
      existing.totalAmount += payment.requestedAmount || 0;
    });

    return Array.from(grouped.values());
  }, [payments, beneficiaries, beneficiaryLoading]);

  // Apply filters
  const filteredPayments = useMemo(() => {
    return aggregatedPayments.filter((item) => {
      // Status filter
      if (filters.status && filters.status.length > 0) {
        if (!filters.status.includes(item.status)) {
          return false;
        }
      }

      // Beneficiary name filter
      if (filters.beneficiaryName) {
        const name = item.beneficiaryName.toLowerCase();
        const filter = filters.beneficiaryName.toLowerCase();
        if (!name.includes(filter)) {
          return false;
        }
      }

      return true;
    });
  }, [aggregatedPayments, filters]);

  // Apply sorting
  const sortedPayments = useMemo(() => {
    if (!sortConfig) {
      return filteredPayments;
    }

    const sorted = [...filteredPayments];

    sorted.sort((a, b) => {
      let comparison = 0;

      switch (sortConfig.field) {
        case "beneficiaryName":
          comparison = a.beneficiaryName.localeCompare(b.beneficiaryName);
          break;
        case "status":
          comparison = a.status.localeCompare(b.status);
          break;
        case "totalAmount":
          comparison = a.totalAmount - b.totalAmount;
          break;
        default:
          return 0;
      }

      return sortConfig.order === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [filteredPayments, sortConfig]);

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Table */}
      <div className="h-[calc(100vh-18rem)] overflow-auto">
        <table className="w-full min-w-full">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#eff0fe]">
              <th className="rounded-l-lg px-4 py-3 text-left text-sm font-semibold text-gray-900">
                Beneficiary Name
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
              <th className="rounded-r-lg px-4 py-3 text-left text-sm font-semibold text-gray-900">
                Transaction Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedPayments.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-500">
                  No aggregated payments found.
                </td>
              </tr>
            ) : (
              sortedPayments.map((item, index) => (
                <tr
                  key={`${item.beneficiaryId}-${item.status}-${index}`}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-700">{item.beneficiaryName}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                        item.status === "PENDING"
                          ? "bg-[#FFF3E0] text-[#F57C00]"
                          : "bg-[#E8F5E9] text-[#2E7D32]"
                      }`}
                    >
                      ● {item.status === "PENDING" ? "Payment pending" : "Completed"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-gray-900">
                      {formatCurrency(item.totalAmount)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
