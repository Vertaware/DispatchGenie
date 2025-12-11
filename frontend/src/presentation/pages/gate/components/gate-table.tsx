"use client";

import dayjs from "dayjs";
import type { Gate } from "~/domain/entities/gate";
import { UserRole } from "~/domain/enums/enum";
import useAuth from "~/presentation/hooks/useAuth";

type GateTableProps = {
  data: Gate[];
  loading?: boolean;
  onGateIn: (gateId: string) => void;
  onGateOut: (gateId: string) => void;
  onDelete: (gateId: string) => void;
  gateInLoading: boolean;
  gateOutLoading: boolean;
  deleteLoading: boolean;
};

const STATUS_COLORS: Record<string, string> = {
  CHECK_IN: "bg-yellow-100 text-yellow-800",
  GATE_IN: "bg-green-100 text-green-800",
  GATE_OUT: "bg-gray-100 text-gray-800",
  CANCELLED: "bg-red-100 text-red-800",
};

export default function GateTable({
  data,
  loading = false,
  onGateIn,
  onGateOut,
  onDelete,
  gateInLoading,
  gateOutLoading,
  deleteLoading,
}: GateTableProps) {
  const { session } = useAuth();
  const userRole = (session?.user as any)?.user?.role as UserRole | undefined;

  // Only ADMIN and SECURITY can perform gate operations
  const canPerformOperations = userRole === UserRole.ADMIN || userRole === UserRole.SECURITY;
  const renderHeader = () => {
    return (
      <>
        <th className="rounded-l-lg px-4 py-3 text-left text-sm font-semibold text-gray-900">
          Date
        </th>
        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Vehicle Number</th>
        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">SO Number</th>
        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Vehicle Type</th>
        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Gate In</th>
        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Gate Out</th>
        <th className="rounded-r-lg px-4 py-3 text-left text-sm font-semibold text-gray-900">
          Actions
        </th>
      </>
    );
  };

  const renderRows = () => {
    if (loading) {
      return (
        <tr>
          <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">
            Loading gate entries...
          </td>
        </tr>
      );
    }

    if (data.length === 0) {
      return (
        <tr>
          <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">
            No gate entries found.
          </td>
        </tr>
      );
    }

    return data.map((gate) => (
      <tr key={gate.id} className="border-b border-gray-100 transition-colors hover:bg-gray-50">
        <td className="px-4 py-3 text-sm text-gray-700">
          {dayjs(gate.checkInAt).format("DD/MM/YYYY")}
        </td>
        <td className="px-4 py-3 text-sm text-gray-700">
          <div>
            <span className="font-medium">{gate.vehicleNumber}</span>
            {!gate.vehicleId && <span className="ml-2 text-xs text-orange-600">(Unlinked)</span>}
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-gray-700">{gate.soNumber || "—"}</td>
        <td className="px-4 py-3 text-sm text-gray-700">{gate.vehicle?.placedTruckType || "—"}</td>
        <td className="px-4 py-3">
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
              STATUS_COLORS[gate.status] || "bg-gray-100 text-gray-800"
            }`}
          >
            {gate.status.replace(/_/g, " ")}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-gray-700">
          {gate.gateInAt ? dayjs(gate.gateInAt).format("DD/MM/YYYY HH:mm") : "—"}
        </td>
        <td className="px-4 py-3 text-sm text-gray-700">
          {gate.gateOutAt ? dayjs(gate.gateOutAt).format("DD/MM/YYYY HH:mm") : "—"}
        </td>
        <td className="px-4 py-3">
          {canPerformOperations ? (
            <div className="flex items-center gap-2">
              {gate.status === "CHECK_IN" && (
                <button
                  onClick={() => onGateIn(gate.id)}
                  disabled={gateInLoading}
                  className="rounded bg-green-600 px-3 py-1 text-xs text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Gate In
                </button>
              )}
              {gate.status === "GATE_IN" && (
                <button
                  onClick={() => onGateOut(gate.id)}
                  disabled={gateOutLoading}
                  className="rounded bg-orange-600 px-3 py-1 text-xs text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Gate Out
                </button>
              )}
              {gate.status === "CHECK_IN" && (
                <button
                  onClick={() => onDelete(gate.id)}
                  disabled={deleteLoading}
                  className="rounded bg-red-600 px-3 py-1 text-xs text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Delete
                </button>
              )}
            </div>
          ) : (
            <span className="text-sm text-gray-400">—</span>
          )}
        </td>
      </tr>
    ));
  };

  return (
    <div className="rounded-lg bg-white shadow-sm">
      <div className="h-[calc(100vh-8rem)] overflow-auto px-2">
        <table className="w-full min-w-full">
          <thead className="sticky top-2 z-10">
            <tr className="bg-[#eff0fe]">{renderHeader()}</tr>
          </thead>
          <tbody>{renderRows()}</tbody>
        </table>
      </div>
    </div>
  );
}
