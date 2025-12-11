"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  deleteGateEntry,
  gateInEntry,
  gateOutEntry,
  type ListGateEntriesParams,
} from "~/infrastructure/services/gate.service";
import { gateQueryKeys, useGates } from "~/presentation/hooks/useGates";
import { useSnackbar } from "~/shared/contexts";
import GateTable from "./gate-table";

export default function GateContainer() {
  const { showSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(25);

  const listParams = useMemo<ListGateEntriesParams>(
    () => ({
      page: currentPage,
      pageSize: rowsPerPage,
    }),
    [currentPage, rowsPerPage],
  );

  const { data, isLoading, error } = useGates(listParams);

  useEffect(() => {
    if (error) {
      showSnackbar({
        message: error instanceof Error ? error.message : "Failed to load gate entries",
        severity: "error",
      });
    }
  }, [error, showSnackbar]);

  const gateEntries = data?.data || [];
  const totalPages = data ? Math.ceil(data.totalCount / data.pageSize) : 1;
  const totalResults = data?.totalCount || 0;

  const gateInMutation = useMutation({
    mutationFn: gateInEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gateQueryKeys.all });
      showSnackbar({
        message: "Gate entry gate-in successful",
        severity: "success",
      });
    },
    onError: (error: unknown) => {
      showSnackbar({
        message: error instanceof Error ? error.message : "Failed to gate-in entry",
        severity: "error",
      });
    },
  });

  const gateOutMutation = useMutation({
    mutationFn: gateOutEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gateQueryKeys.all });
      showSnackbar({
        message: "Gate entry gate-out successful",
        severity: "success",
      });
    },
    onError: (error: unknown) => {
      showSnackbar({
        message: error instanceof Error ? error.message : "Failed to gate-out entry",
        severity: "error",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteGateEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gateQueryKeys.all });
      showSnackbar({
        message: "Gate entry deleted successfully",
        severity: "success",
      });
    },
    onError: (error: unknown) => {
      showSnackbar({
        message: error instanceof Error ? error.message : "Failed to delete gate entry",
        severity: "error",
      });
    },
  });

  const handleGateIn = (gateId: string) => {
    if (confirm("Are you sure you want to gate-in this entry?")) {
      gateInMutation.mutate(gateId);
    }
  };

  const handleGateOut = (gateId: string) => {
    if (confirm("Are you sure you want to gate-out this entry?")) {
      gateOutMutation.mutate(gateId);
    }
  };

  const handleDelete = (gateId: string) => {
    if (confirm("Are you sure you want to delete this gate entry? This action cannot be undone.")) {
      deleteMutation.mutate(gateId);
    }
  };

  /*  const handleRowsPerPageChange = (value: number) => {
    setRowsPerPage(value);
    setCurrentPage(1);
  }; */

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const errorMessage =
    error instanceof Error ? error.message : error ? "Unable to load gate entries." : null;

  return (
    <div className="p-4">
      <div className="rounded-lg bg-white shadow-sm">
        <GateTable
          data={gateEntries}
          loading={isLoading}
          onGateIn={handleGateIn}
          onGateOut={handleGateOut}
          onDelete={handleDelete}
          gateInLoading={gateInMutation.isPending}
          gateOutLoading={gateOutMutation.isPending}
          deleteLoading={deleteMutation.isPending}
        />
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
