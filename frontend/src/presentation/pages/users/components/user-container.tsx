"use client";

import { useEffect, useMemo, useState } from "react";
import type { ListUsersParams } from "~/infrastructure/services/user.service";
import { useUsers } from "~/presentation/hooks/useUsers";
import { useSnackbar } from "~/shared/contexts";
import UserTable from "./user-table";

export default function UserContainer() {
  const { showSnackbar } = useSnackbar();
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(25);

  const listParams = useMemo<ListUsersParams>(
    () => ({
      page: currentPage,
      pageSize: rowsPerPage,
    }),
    [currentPage, rowsPerPage],
  );

  const { data, isLoading, error } = useUsers(listParams);

  useEffect(() => {
    if (error) {
      showSnackbar({
        message: error instanceof Error ? error.message : "Failed to load users",
        severity: "error",
      });
    }
  }, [error, showSnackbar]);

  const users = data?.data || [];
  const totalPages = data ? Math.ceil(data.totalCount / data.pageSize) : 1;
  const totalResults = data?.totalCount || 0;

  /* const handleRowsPerPageChange = (value: number) => {
    setRowsPerPage(value);
    setCurrentPage(1);
  }; */

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const errorMessage =
    error instanceof Error ? error.message : error ? "Unable to load users." : null;

  return (
    <div className="p-4">
      <div className="rounded-lg bg-white shadow-sm">
        <UserTable data={users} loading={isLoading} />
        {errorMessage ? <p className="px-4 text-sm text-red-500">{errorMessage}</p> : null}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
            <div className="text-sm text-gray-700">
              Showing {(currentPage - 1) * rowsPerPage + 1} to{" "}
              {Math.min(currentPage * rowsPerPage, totalResults)} of {totalResults} results
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
