"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { IoArrowDown, IoArrowUp, IoCreateOutline } from "react-icons/io5";
import { getDocumentViewerUrl } from "~/infrastructure/services";
import type { Beneficiary } from "~/infrastructure/services/beneficiary.service";
import { useSnackbar } from "~/shared/contexts";
import BeneficiaryRecordModal from "./beneficiary-record-modal";
import type { ColumnConfig } from "./columns-popover";
import type { SortConfig } from "./sort-popover";

type BeneficiaryTableProps = {
  data: Beneficiary[];
  loading?: boolean;
  currentSort?: SortConfig | null;
  columns: ColumnConfig[];
};

export default function BeneficiaryTable({
  data,
  loading = false,
  currentSort,
  columns,
}: BeneficiaryTableProps) {
  const { data: session }: any = useSession();
  const { showSnackbar } = useSnackbar();
  const visibleColumns = columns.filter((col) => col.visible !== false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<Beneficiary | null>(null);

  const handleEdit = (beneficiary: Beneficiary) => {
    setSelectedBeneficiary(beneficiary);
    setEditModalOpen(true);
  };

  const handleModalClose = () => {
    setEditModalOpen(false);
    setSelectedBeneficiary(null);
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
        newWindow.document.title = "Bank Statement.pdf";
      } else {
        showSnackbar({ message: "Unable to open document.", severity: "error" });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to open document.";
      showSnackbar({ message, severity: "error" });
    }
  };

  const renderSortIcon = (field: string) => {
    if (!currentSort || currentSort.field !== field) return null;
    return currentSort.order === "asc" ? (
      <IoArrowUp className="ml-1 inline text-[#6C63FF]" />
    ) : (
      <IoArrowDown className="ml-1 inline text-[#6C63FF]" />
    );
  };

  const renderCell = (column: ColumnConfig, beneficiary: Beneficiary) => {
    switch (column.key) {
      case "name":
        return <span className="text-sm text-gray-900">{beneficiary.name}</span>;
      case "accountNumber":
        return <span className="text-sm text-gray-700">{beneficiary.accountNumber}</span>;
      case "bankNameAndBranch":
        return <span className="text-sm text-gray-700">{beneficiary.bankNameAndBranch}</span>;
      case "ifscCode":
        return <span className="text-sm text-gray-700">{beneficiary.ifscCode}</span>;
      case "contactInfo":
        return <span className="text-sm text-gray-700">{beneficiary.contactInfo || "—"}</span>;
      case "document":
        return beneficiary.documentId ? (
          <button
            onClick={() => handleViewDocument(beneficiary.documentId ?? "")}
            className="inline-flex items-center gap-2 text-sm text-[#6C63FF] hover:underline"
          >
            <svg className="size-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                clipRule="evenodd"
              />
            </svg>
            Bank Document.pdf
          </button>
        ) : (
          <span className="text-sm text-gray-400">—</span>
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
          Action
        </th>
      </>
    );
  };

  const renderRows = () => {
    const colSpan = visibleColumns.length + 1; // +1 for Action column

    if (loading) {
      return (
        <tr>
          <td colSpan={colSpan} className="px-4 py-6 text-center text-sm text-gray-500">
            Loading beneficiaries...
          </td>
        </tr>
      );
    }

    if (data.length === 0) {
      return (
        <tr>
          <td colSpan={colSpan} className="px-4 py-6 text-center text-sm text-gray-500">
            No beneficiaries found.
          </td>
        </tr>
      );
    }

    return data.map((beneficiary) => (
      <tr
        key={beneficiary.id}
        className="border-b border-gray-100 transition-colors hover:bg-gray-50"
      >
        {visibleColumns.map((column) => (
          <td key={column.key} className="px-4 py-3">
            {renderCell(column, beneficiary)}
          </td>
        ))}
        <td className="px-4 py-3">
          <button
            onClick={() => handleEdit(beneficiary)}
            className="rounded p-2 text-[#6C63FF] transition-colors hover:bg-[#6C63FF]/10"
            aria-label="Edit beneficiary"
          >
            <IoCreateOutline className="text-xl" />
          </button>
        </td>
      </tr>
    ));
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
      <BeneficiaryRecordModal
        open={editModalOpen}
        onClose={handleModalClose}
        beneficiary={selectedBeneficiary}
      />
    </>
  );
}
