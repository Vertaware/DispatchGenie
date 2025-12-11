"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getBeneficiary } from "~/infrastructure/services/beneficiary.service";
import type {
  BankTransaction,
  BankTransactionWithDetails,
} from "~/infrastructure/services/transaction.service";
import { getBankTransaction } from "~/infrastructure/services/transaction.service";
import type { TotalViewFilters } from "./total-view-filter-panel";
import type { TotalViewSortConfig } from "./total-view-sort-popover";

type TransactionsTotalViewProps = {
  transactions: BankTransaction[];
  sortConfig: TotalViewSortConfig | null;
  filters: TotalViewFilters;
};

type AggregatedTransaction = {
  beneficiaryId: string;
  beneficiaryName: string;
  totalPaidAmount: number;
  remainingBalance: number;
};

const formatCurrency = (amount: number) => {
  return `₹${amount.toLocaleString("en-IN")}`;
};

export default function TransactionsTotalView({
  transactions,
  sortConfig,
  filters,
}: TransactionsTotalViewProps) {
  const [beneficiaries, setBeneficiaries] = useState<Record<string, string>>({});
  const [beneficiaryLoading, setBeneficiaryLoading] = useState<Set<string>>(new Set());
  const [transactionDetails, setTransactionDetails] = useState<
    Record<string, BankTransactionWithDetails | null>
  >({});
  const fetchedRef = useRef<Set<string>>(new Set());
  const detailsFetchedRef = useRef<Set<string>>(new Set());

  // Fetch beneficiary names for all unique beneficiary IDs
  useEffect(() => {
    const uniqueBeneficiaryIds = Array.from(
      new Set(transactions.map((t) => t.beneficiaryId).filter(Boolean)),
    );

    uniqueBeneficiaryIds.forEach((id) => {
      if (fetchedRef.current.has(id)) return;

      fetchedRef.current.add(id);
      setBeneficiaryLoading((prev) => new Set(prev).add(id));

      getBeneficiary(id)
        .then((beneficiary) => {
          setBeneficiaries((prev) => {
            if (prev[id]) return prev;
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
  }, [transactions]);

  // Fetch transaction details to calculate remaining balance
  useEffect(() => {
    transactions.forEach((transaction) => {
      if (detailsFetchedRef.current.has(transaction.id)) return;

      detailsFetchedRef.current.add(transaction.id);

      getBankTransaction(transaction.id)
        .then((detail) => {
          setTransactionDetails((prev) => {
            if (prev[transaction.id]) return prev;
            return { ...prev, [transaction.id]: detail };
          });
        })
        .catch((error) => {
          // eslint-disable-next-line no-console
          console.error(`Failed to load transaction details ${transaction.id}`, error);
          setTransactionDetails((prev) => {
            if (prev[transaction.id]) return prev;
            return { ...prev, [transaction.id]: null };
          });
        });
    });
  }, [transactions]);

  // Aggregate transactions by beneficiary
  const aggregatedTransactions = useMemo(() => {
    const grouped = new Map<string, AggregatedTransaction>();

    transactions.forEach((transaction) => {
      const beneficiaryName =
        beneficiaries[transaction.beneficiaryId] ||
        (beneficiaryLoading.has(transaction.beneficiaryId) ? "Loading..." : "--");

      // Calculate remaining balance for this transaction
      const detail = transactionDetails[transaction.id];
      const remainingBalance =
        !detail || !detail.allocations
          ? transaction.totalPaidAmount // If no allocations, full amount is remaining
          : transaction.totalPaidAmount -
            detail.allocations.reduce((sum, alloc) => sum + alloc.allocatedAmount, 0);

      if (!grouped.has(transaction.beneficiaryId)) {
        grouped.set(transaction.beneficiaryId, {
          beneficiaryId: transaction.beneficiaryId,
          beneficiaryName,
          totalPaidAmount: 0,
          remainingBalance: 0,
        });
      }

      const existing = grouped.get(transaction.beneficiaryId)!;
      existing.totalPaidAmount += transaction.totalPaidAmount;
      existing.remainingBalance += remainingBalance;
    });

    return Array.from(grouped.values());
  }, [transactions, beneficiaries, beneficiaryLoading, transactionDetails]);

  // Apply filters
  const filteredTransactions = useMemo(() => {
    return aggregatedTransactions.filter((item) => {
      // Beneficiary name filter
      if (filters.beneficiaryName) {
        const name = item.beneficiaryName.toLowerCase();
        const filter = filters.beneficiaryName.toLowerCase();
        if (!name.includes(filter)) {
          return false;
        }
      }

      // Total paid amount filter
      if (filters.totalPaidAmount) {
        const { operator, value } = filters.totalPaidAmount;
        switch (operator) {
          case "equals":
            if (item.totalPaidAmount !== value) return false;
            break;
          case "greaterThan":
            if (item.totalPaidAmount <= value) return false;
            break;
          case "lessThan":
            if (item.totalPaidAmount >= value) return false;
            break;
          case "greaterThanOrEqual":
            if (item.totalPaidAmount < value) return false;
            break;
          case "lessThanOrEqual":
            if (item.totalPaidAmount > value) return false;
            break;
        }
      }

      // Remaining balance filter
      if (filters.remainingBalance) {
        const { operator, value } = filters.remainingBalance;
        switch (operator) {
          case "equals":
            if (item.remainingBalance !== value) return false;
            break;
          case "greaterThan":
            if (item.remainingBalance <= value) return false;
            break;
          case "lessThan":
            if (item.remainingBalance >= value) return false;
            break;
          case "greaterThanOrEqual":
            if (item.remainingBalance < value) return false;
            break;
          case "lessThanOrEqual":
            if (item.remainingBalance > value) return false;
            break;
        }
      }

      return true;
    });
  }, [aggregatedTransactions, filters]);

  // Apply sorting
  const sortedTransactions = useMemo(() => {
    if (!sortConfig) {
      return filteredTransactions;
    }

    const sorted = [...filteredTransactions];

    sorted.sort((a, b) => {
      let comparison = 0;

      switch (sortConfig.field) {
        case "beneficiaryName":
          comparison = a.beneficiaryName.localeCompare(b.beneficiaryName);
          break;
        case "totalPaidAmount":
          comparison = a.totalPaidAmount - b.totalPaidAmount;
          break;
        case "remainingBalance":
          comparison = a.remainingBalance - b.remainingBalance;
          break;
        default:
          return 0;
      }

      return sortConfig.order === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [filteredTransactions, sortConfig]);

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
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                Total Paid Amount
              </th>
              <th className="rounded-r-lg px-4 py-3 text-left text-sm font-semibold text-gray-900">
                Remaining Balance
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedTransactions.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-500">
                  No aggregated transactions found.
                </td>
              </tr>
            ) : (
              sortedTransactions.map((item) => (
                <tr key={item.beneficiaryId} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-700">{item.beneficiaryName}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-gray-900">
                      {formatCurrency(item.totalPaidAmount)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-gray-900">
                      {formatCurrency(item.remainingBalance)}
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
