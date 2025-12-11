"use client";

import {
  IoChevronBack,
  IoChevronBackOutline,
  IoChevronForward,
  IoChevronForwardOutline,
} from "react-icons/io5";

type TablePaginationProps = {
  currentPage: number;
  totalPages: number;
  rowsPerPage: number;
  totalResults: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rowsPerPage: number) => void;
};

export default function SOTablePagination({
  currentPage,
  totalPages,
  rowsPerPage,
  totalResults,
  onPageChange,
  onRowsPerPageChange,
}: TablePaginationProps) {
  const hasResults = totalResults > 0;
  const safeTotalPages = Math.max(1, totalPages);
  const startResult = hasResults ? (currentPage - 1) * rowsPerPage + 1 : 0;
  const endResult = hasResults ? Math.min(currentPage * rowsPerPage, totalResults) : 0;

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="text-sm text-gray-600">
        {hasResults
          ? `Showing ${startResult} to ${endResult} of ${totalResults} results`
          : "No results to display"}
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Rows per page</span>
          <select
            value={rowsPerPage}
            onChange={(e) => onRowsPerPageChange(Number(e.target.value))}
            className="rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#6C63FF]"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            Page {hasResults ? currentPage : 0} of {hasResults ? safeTotalPages : 0}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(1)}
              disabled={!hasResults || currentPage === 1}
              className="rounded border border-gray-300 p-1.5 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <IoChevronBackOutline className="text-gray-600" />
            </button>
            <button
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={!hasResults || currentPage === 1}
              className="rounded border border-gray-300 p-1.5 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <IoChevronBack className="text-gray-600" />
            </button>
            <button
              onClick={() => onPageChange(Math.min(safeTotalPages, currentPage + 1))}
              disabled={!hasResults || currentPage === safeTotalPages}
              className="rounded border border-gray-300 p-1.5 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <IoChevronForward className="text-gray-600" />
            </button>
            <button
              onClick={() => onPageChange(safeTotalPages)}
              disabled={!hasResults || currentPage === safeTotalPages}
              className="rounded border border-gray-300 p-1.5 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <IoChevronForwardOutline className="text-gray-600" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
