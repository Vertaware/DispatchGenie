"use client";

import dayjs from "dayjs";
import { Fragment, useState } from "react";
import type { Vehicle } from "~/domain/entities/vehicle";
import { formatCurrency } from "~/shared/utils/format";

type VehicleTableProps = {
  data: Vehicle[];
  loading?: boolean;
  selectedVehicleIds: Set<string>;
  onSelectionChange: (vehicleId: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
};

export default function VehicleTable({
  data,
  loading = false,
  selectedVehicleIds,
  onSelectionChange,
  onSelectAll,
}: VehicleTableProps) {
  const [selectAllChecked, setSelectAllChecked] = useState(false);

  const handleSelectAllChange = (checked: boolean) => {
    setSelectAllChecked(checked);
    onSelectAll(checked);
  };

  const handleRowCheckboxChange = (vehicleId: string, checked: boolean) => {
    onSelectionChange(vehicleId, checked);
    // Update select all state based on current selections
    if (!checked) {
      setSelectAllChecked(false);
    } else {
      const allSelected = data.every((v) => selectedVehicleIds.has(v.id) || v.id === vehicleId);
      setSelectAllChecked(allSelected);
    }
  };

  const renderRows = () => {
    const colSpan = 8; // checkbox + vehicleNumber + driverName + driverPhone + vehicleAmount + status + createdAt + actions

    if (loading) {
      return (
        <tr>
          <td colSpan={colSpan} className="px-4 py-6 text-center text-sm text-gray-500">
            Loading vehicles...
          </td>
        </tr>
      );
    }

    if (data.length === 0) {
      return (
        <tr>
          <td colSpan={colSpan} className="px-4 py-6 text-center text-sm text-gray-500">
            No vehicles found.
          </td>
        </tr>
      );
    }

    return data.map((vehicle) => {
      const isSelected = selectedVehicleIds.has(vehicle.id);
      return (
        <Fragment key={vehicle.id}>
          <tr className="border-b border-gray-100 hover:bg-gray-50">
            <td className="px-4 py-3">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => handleRowCheckboxChange(vehicle.id, e.target.checked)}
                className="size-4 rounded border-gray-300 text-[#6C63FF] focus:ring-[#6C63FF]"
              />
            </td>
            <td className="px-4 py-3">
              <span className="text-sm font-medium text-gray-900">{vehicle.vehicleNumber}</span>
            </td>
            <td className="px-4 py-3">
              <span className="text-sm text-gray-700">{vehicle.driverName ?? "—"}</span>
            </td>
            <td className="px-4 py-3">
              <span className="text-sm text-gray-700">{vehicle.driverPhoneNumber ?? "—"}</span>
            </td>
            <td className="px-4 py-3">
              <span className="text-sm font-medium text-gray-700">
                {formatCurrency(vehicle.vehicleAmount)}
              </span>
            </td>
            <td className="px-4 py-3">
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                  vehicle.status === "COMPLETED"
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {vehicle.status}
              </span>
            </td>
            <td className="px-4 py-3">
              <span className="text-sm text-gray-700">
                {vehicle.createdAt ? dayjs(vehicle.createdAt).format("DD/MM/YYYY") : "—"}
              </span>
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
          <tr className="bg-[#eff0fe]">
            <th className="rounded-l-lg px-4 py-3 text-left">
              <input
                type="checkbox"
                checked={selectAllChecked && data.length > 0}
                onChange={(e) => handleSelectAllChange(e.target.checked)}
                className="size-4 rounded border-gray-300 text-[#6C63FF] focus:ring-[#6C63FF]"
              />
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
              Vehicle Number
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Driver Name</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
              Driver Phone
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
              Vehicle Amount
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Created At</th>
          </tr>
        </thead>
        <tbody>{renderRows()}</tbody>
      </table>
    </div>
  );
}
