"use client";

import dayjs from "dayjs";
import { useSession } from "next-auth/react";
import { Fragment, useState } from "react";
import {
  IoArrowDown,
  IoArrowUp,
  IoCallOutline,
  IoCarOutline,
  IoChevronDown,
  IoChevronUp,
} from "react-icons/io5";
import type { Vehicle } from "~/domain/entities/vehicle";
import { getDocumentViewerUrl } from "~/infrastructure/services";
import type { VehicleDetail, VehicleDocument } from "~/infrastructure/services/vehicle.service";
import { getVehicle } from "~/infrastructure/services/vehicle.service";
import { useSnackbar } from "~/shared/contexts";
import type { ColumnConfig } from "./columns-popover";
import type { SortConfig } from "./sort-popover";
import UpdateVehicleModal from "./update-vehicle-modal";

type VehicleTableProps = {
  data: Vehicle[];
  loading?: boolean;
  onRefresh?: () => void;
  currentSort?: SortConfig | null;
  columns: ColumnConfig[];
};

const STATUS_COLORS: Record<string, string> = {
  ASSIGNED: "bg-blue-500",
  ARRIVED: "bg-emerald-500",
  GATE_IN: "bg-cyan-500",
  LOADING_START: "bg-orange-500",
  LOADING_COMPLETE: "bg-lime-500",
  TRIP_INVOICED: "bg-amber-600",
  GATE_OUT: "bg-sky-600",
  IN_JOURNEY: "bg-purple-500",
  COMPLETED: "bg-green-600",
  INVOICED: "bg-indigo-600",
  CANCELLED: "bg-red-600",
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "--";
  return dayjs(value).format("DD/MM/YYYY, hh:mm A");
};

const formatWaitingTime = (hours?: number | null) => {
  if (!hours) return "--";
  const days = Math.floor(hours / 24);
  const hrs = Math.round(hours % 24);
  const dayText = days > 0 ? `${days} day${days > 1 ? "s" : ""}` : "";
  const hourText = hrs > 0 ? `${hrs} hour${hrs > 1 ? "s" : ""}` : "";
  return [dayText, hourText].filter(Boolean).join(", ") || `${hours} hrs`;
};

export default function VehicleTable({
  data,
  loading = false,
  currentSort,
  columns,
}: VehicleTableProps) {
  const visibleColumns = columns.filter((col) => col.visible !== false);
  const { showSnackbar } = useSnackbar();
  const { data: session }: any = useSession();
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [detailCache, setDetailCache] = useState<Record<string, VehicleDetail | null>>({});
  const [detailLoading, setDetailLoading] = useState<Record<string, boolean>>({});
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedVehicleDocuments, setSelectedVehicleDocuments] = useState<VehicleDocument[]>([]);

  const renderSortIcon = (field: string) => {
    if (!currentSort || currentSort.field !== field) return null;
    return currentSort.order === "asc" ? (
      <IoArrowUp className="ml-1 inline text-[#6C63FF]" />
    ) : (
      <IoArrowDown className="ml-1 inline text-[#6C63FF]" />
    );
  };

  const renderCell = (column: ColumnConfig, vehicle: Vehicle, isExpanded: boolean) => {
    switch (column.key) {
      case "vehicleNumber":
        return (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleToggleRow(vehicle.id)}
              className="rounded-full border border-gray-300 p-1 hover:bg-gray-100"
            >
              {isExpanded ? <IoChevronUp /> : <IoChevronDown />}
            </button>
            <div className="flex items-center gap-2">
              <IoCarOutline className="text-xl text-gray-500" />
              <div>
                <div className="font-semibold text-[#3f37c9]">{vehicle.vehicleNumber}</div>
                <div className="text-xs text-gray-500">{vehicle.vehicleName ?? "—"}</div>
              </div>
            </div>
          </div>
        );
      case "driverPhone":
        return (
          <div className="flex items-center gap-2">
            <IoCallOutline className="text-gray-500" />
            <span className="text-sm text-gray-700">{vehicle.driverPhone ?? "—"}</span>
          </div>
        );
      case "shippingAmount":
        return (
          <span className="text-sm text-gray-700">
            ₹{vehicle.shippingAmount?.toLocaleString("en-IN") ?? "--"}
          </span>
        );
      case "locationReachedAt":
        return (
          <span className="text-sm text-gray-700">{formatDateTime(vehicle.locationReachedAt)}</span>
        );
      case "unloadedAt":
        return (
          <span className="text-sm text-gray-700">{formatDateTime(vehicle.unloadedTime)}</span>
        );
      case "dbWaitingTimeHours":
        return (
          <span className="text-sm text-gray-700">
            {formatWaitingTime(vehicle.dbWaitingTimeHours)}
          </span>
        );
      case "status":
        return (
          <span className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
            <span
              className={`size-2 rounded-full ${STATUS_COLORS[vehicle.status] ?? "bg-gray-400"}`}
            />
            {vehicle.status.replace(/_/g, " ")}
          </span>
        );
      default:
        return <span>—</span>;
    }
  };

  const handleToggleRow = async (vehicleId: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [vehicleId]: !prev[vehicleId],
    }));

    if (!detailCache[vehicleId]) {
      setDetailLoading((prev) => ({ ...prev, [vehicleId]: true }));
      try {
        const detail = await getVehicle(vehicleId);
        setDetailCache((prev) => ({ ...prev, [vehicleId]: detail }));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load vehicle details.";
        showSnackbar({ message, severity: "error" });
        setExpandedRows((prev) => ({ ...prev, [vehicleId]: false }));
      } finally {
        setDetailLoading((prev) => ({ ...prev, [vehicleId]: false }));
      }
    }
  };

  const handleOpenUpdateModal = async (vehicle: Vehicle) => {
    if (!detailCache[vehicle.id]) {
      setDetailLoading((prev) => ({ ...prev, [vehicle.id]: true }));
      try {
        const detail = await getVehicle(vehicle.id);
        setDetailCache((prev) => ({ ...prev, [vehicle.id]: detail }));
        setSelectedVehicleDocuments(detail.documents);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load vehicle details.";
        showSnackbar({ message, severity: "error" });
        return;
      } finally {
        setDetailLoading((prev) => ({ ...prev, [vehicle.id]: false }));
      }
    } else {
      setSelectedVehicleDocuments(detailCache[vehicle.id]?.documents ?? []);
    }
    setSelectedVehicle(vehicle);
    setUpdateModalOpen(true);
  };

  const handleCloseUpdateModal = () => {
    setUpdateModalOpen(false);
    setSelectedVehicle(null);
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

  const handleViewDocument = async (doc: VehicleDocument) => {
    try {
      const { url } = await getDocumentViewerUrl(doc.id);
      const blob = await fetchDocument(url);
      const newWindow = window.open(URL.createObjectURL(blob), "_blank", "noopener,noreferrer");
      if (newWindow) {
        newWindow.document.title = doc.fileName;
      } else {
        showSnackbar({ message: "Unable to open document.", severity: "error" });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to open document.";
      showSnackbar({ message, severity: "error" });
    }
  };

  const renderOrders = (vehicleId: string) => {
    const detail = detailCache[vehicleId];
    if (detailLoading[vehicleId]) {
      return <div className="px-6 py-3 text-sm text-gray-500">Loading vehicle details...</div>;
    }
    if (!detail) {
      return (
        <div className="px-6 py-3 text-sm text-gray-500">
          No details available for this vehicle.
        </div>
      );
    }
    const hasOrders = detail.salesOrders.length > 0;
    return (
      <>
        {hasOrders ? (
          detail.salesOrders.map((order) => (
            <div
              key={order.id}
              className="flex items-center justify-between gap-2 border-b border-gray-100 px-6 py-2 text-sm last:border-0"
            >
              <div className="font-semibold text-[#3f37c9]">SO #{order.soNumber}</div>
              <div className="flex flex-col gap-1">
                <span className="block text-xs text-gray-500">SO Date</span>
                <span className="font-semibold">{dayjs(order.soDate).format("DD/MM/YYYY")}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="block text-xs text-gray-500">Customer ID</span>
                <span className="font-semibold">{order.customerId ?? "—"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="block text-xs text-gray-500">Party Name</span>
                <span className="font-semibold">{order.partyName ?? "—"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="block text-xs text-gray-500">Location</span>
                <span className="font-semibold">{order.townName ?? "—"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="block text-xs text-gray-500">Qty</span>
                <span className="font-semibold">{order.quantity ?? "—"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="block text-xs text-gray-500">Trip Reference No</span>
                <span className="font-semibold">{order.tripReferenceNo ?? "—"}</span>
              </div>
            </div>
          ))
        ) : (
          <div className="px-6 py-3 text-sm text-gray-500">
            No sales orders have been assigned to this vehicle yet.
          </div>
        )}
        <div className="border-t border-gray-100 px-6 py-3">
          <div className="mb-2 text-sm font-semibold text-gray-800">Documents</div>
          {detail.documents.length === 0 ? (
            <div className="text-sm text-gray-500">No documents uploaded for this vehicle.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {detail.documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-100 bg-white px-3 py-2 text-sm shadow-sm"
                >
                  <div className="flex flex-col">
                    <span className="font-semibold">{doc.type.replace(/_/g, " ")}</span>
                    <span className="text-xs text-gray-500">{doc.fileName}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-400">
                      Updated {dayjs(doc.updatedAt).format("DD/MM/YYYY")}
                    </span>
                    <button
                      type="button"
                      className="text-sm text-blue-500 hover:text-blue-600"
                      onClick={() => handleViewDocument(doc)}
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </>
    );
  };

  const renderRows = () => {
    const colSpan = visibleColumns.length + 1; // +1 for Actions column

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
            No vehicles found for the selected filters.
          </td>
        </tr>
      );
    }

    return data.map((vehicle) => {
      const isExpanded = Boolean(expandedRows[vehicle.id]);
      return (
        <Fragment key={vehicle.id}>
          <tr key={vehicle.id} className="border-b border-gray-100">
            {visibleColumns.map((column) => (
              <td key={column.key} className="px-4 py-3">
                {renderCell(column, vehicle, isExpanded)}
              </td>
            ))}
            <td className="px-4 py-3 text-right">
              <button
                type="button"
                onClick={() => handleOpenUpdateModal(vehicle)}
                className="rounded-full bg-emerald-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-600"
              >
                Update
              </button>
            </td>
          </tr>
          {isExpanded ? (
            <tr className="border-b border-gray-100 bg-gray-50">
              <td colSpan={colSpan}>{renderOrders(vehicle.id)}</td>
            </tr>
          ) : null}
        </Fragment>
      );
    });
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
              {column.key === "vehicleNumber" ? (
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
      <UpdateVehicleModal
        open={updateModalOpen}
        onClose={handleCloseUpdateModal}
        vehicle={selectedVehicle}
        documents={selectedVehicleDocuments}
      />
    </>
  );
}
