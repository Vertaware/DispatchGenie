"use client";

import {
  Button,
  Checkbox,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Popover,
} from "@mui/material";
import { useEffect, useState } from "react";
import { LuGripVertical } from "react-icons/lu";
import { UserRole } from "~/domain/enums/enum";

/**
 * Filter columns based on user role
 * Columns with role restrictions are only included if user has one of the required roles
 */
export const filterColumnsByRole = (
  columns: ColumnConfig[],
  userRole?: UserRole,
): ColumnConfig[] => {
  if (!userRole) {
    // If no role, filter out all role-restricted columns
    return columns.filter((col) => !col.role || col.role.length === 0);
  }
  return columns.filter((col) => {
    // If column has no role restriction, include it
    if (!col.role || col.role.length === 0) {
      return true;
    }
    // Include if user role is in the allowed roles
    return col.role.includes(userRole);
  });
};

export interface ColumnConfig {
  key: string;
  label: string;
  sortField?: string;
  alwaysVisible?: boolean;
  visible?: boolean;
  width?: string;
  role?: UserRole[];
}

export const DEFAULT_COLUMNS: ColumnConfig[] = [
  {
    key: "soNumber",
    label: "SO No",
    sortField: "soNumber",
    alwaysVisible: true,
    width: "140px",
  },
  { key: "soDate", label: "SO Date", sortField: "soDate", width: "140px" },
  { key: "status", label: "Status", sortField: "status", width: "180px" },
  { key: "customerId", label: "Customer ID", sortField: "customerId", width: "140px" },
  { key: "customerName", label: "Customer Name", sortField: "customerName", width: "140px" },
  { key: "partyName", label: "Party Name", sortField: "partyName", width: "140px" },
  { key: "partyAddress", label: "Party Address", sortField: "partyAddress", width: "140px" },
  {
    key: "tripReferenceNo",
    label: "Trip Reference No",
    sortField: "tripReferenceNo",
    width: "160px",
  },
  { key: "townName", label: "Town Name", sortField: "townName", width: "140px" },
  { key: "pinCode", label: "Pin Code", sortField: "pinCode", width: "140px" },
  { key: "sku", label: "SKU", sortField: "sku", width: "140px" },
  {
    key: "articleDescription",
    label: "Article Description",
    sortField: "articleDescription",
    width: "160px",
  },
  { key: "soCases", label: "SO Cases", sortField: "soCases", width: "140px" },
  { key: "caseLot", label: "Case Lot", sortField: "caseLot", width: "140px" },
  {
    key: "requestedTruckSize",
    label: "Requested Truck Size",
    sortField: "requestedTruckSize",
    width: "185px",
  },
  {
    key: "requestedTruckType",
    label: "Requested Truck Type",
    sortField: "requestedTruckType",
    width: "185px",
  },
  {
    key: "placedTruckSize",
    label: "Placed Truck Size",
    sortField: "placedTruckSize",
    width: "165px",
  },
  {
    key: "placedTruckType",
    label: "Placed Truck Type",
    sortField: "placedTruckType",
    width: "165px",
  },
  {
    key: "frightCost",
    label: "Fright Cost",
    sortField: "frightCost",
    width: "140px",
    role: [UserRole.ADMIN],
  },
  { key: "profit", label: "Profit", sortField: "profit", width: "140px", role: [UserRole.ADMIN] },
];

type ColumnsPopoverProps = {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  columns: ColumnConfig[];
  onColumnsChange: (columns: ColumnConfig[]) => void;
  userRole?: UserRole;
};

export default function ColumnsPopover({
  anchorEl,
  open,
  onClose,
  columns,
  onColumnsChange,
  userRole,
}: ColumnsPopoverProps) {
  const [localColumns, setLocalColumns] = useState<ColumnConfig[]>(columns);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setLocalColumns(columns);
    }
  }, [open, columns]);

  const handleToggleVisibility = (key: string) => {
    const column = localColumns.find((col) => col.key === key);
    if (column?.alwaysVisible) return; // Can't hide always visible columns

    setLocalColumns((prev) =>
      prev.map((col) => (col.key === key ? { ...col, visible: !col.visible } : col)),
    );
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newColumns = [...localColumns];
    const [removed] = newColumns.splice(draggedIndex, 1);
    newColumns.splice(dropIndex, 0, removed);

    setLocalColumns(newColumns);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleReset = () => {
    const filteredDefaultColumns = filterColumnsByRole(DEFAULT_COLUMNS, userRole);
    const resetColumns = filteredDefaultColumns.map((col) => ({ ...col, visible: true }));
    // Preserve actions column if it exists in current columns
    const actionsColumn = columns.find((col) => col.key === "actions");
    if (actionsColumn) {
      resetColumns.push({ ...actionsColumn, visible: true });
    }
    setLocalColumns(resetColumns);
  };

  const handleApply = () => {
    onColumnsChange(localColumns);
    onClose();
  };

  const visibleCount = localColumns.filter((col) => col.visible !== false).length;
  const hasChanges = JSON.stringify(localColumns) !== JSON.stringify(columns);

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{
        vertical: "bottom",
        horizontal: "left",
      }}
      transformOrigin={{
        vertical: "top",
        horizontal: "left",
      }}
      slotProps={{
        paper: {
          sx: {
            mt: 1,
            minWidth: 320,
            maxHeight: 500,
            boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
            borderRadius: 2,
          },
        },
      }}
    >
      <div className="py-2">
        <div className="flex items-center justify-between px-4 py-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Columns</p>
            <p className="mt-0.5 text-xs text-gray-400">
              {visibleCount} of {localColumns.length} visible
            </p>
          </div>
          <Button
            size="small"
            onClick={handleReset}
            sx={{
              textTransform: "none",
              fontSize: "0.75rem",
              color: "#6C63FF",
              fontWeight: 500,
              "&:hover": {
                backgroundColor: "#EFF0FE",
              },
            }}
          >
            Reset
          </Button>
        </div>
        <Divider />
        <List disablePadding sx={{ maxHeight: 350, overflowY: "auto" }}>
          {localColumns.map((column, index) => {
            const isVisible = column.visible !== false;
            const isDragging = draggedIndex === index;
            const isDragOver = dragOverIndex === index;
            // Check if column is accessible by current user role
            const isAccessible =
              !column.role ||
              column.role.length === 0 ||
              (userRole && column.role.includes(userRole));

            // Skip rendering if column is not accessible
            if (!isAccessible) {
              return null;
            }

            return (
              <ListItem
                key={column.key}
                disablePadding
                draggable={!column.alwaysVisible}
                onDragStart={(e) => {
                  if (!column.alwaysVisible) {
                    e.dataTransfer.effectAllowed = "move";
                    handleDragStart(index);
                  }
                }}
                onDragOver={(e) => {
                  if (!column.alwaysVisible) {
                    handleDragOver(e, index);
                  }
                }}
                onDrop={(e) => {
                  if (!column.alwaysVisible) {
                    handleDrop(e, index);
                  }
                }}
                onDragEnd={handleDragEnd}
                sx={{
                  opacity: isDragging ? 0.5 : 1,
                  backgroundColor: isDragOver ? "#F3F4F6" : "transparent",
                  cursor: column.alwaysVisible ? "default" : "grab",
                  "&:active": {
                    cursor: column.alwaysVisible ? "default" : "grabbing",
                  },
                  "&:hover": {
                    backgroundColor: "#F9FAFB",
                  },
                }}
              >
                <ListItemButton
                  onClick={() => handleToggleVisibility(column.key)}
                  disabled={column.alwaysVisible}
                  sx={{ py: 1 }}
                >
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    {!column.alwaysVisible && <LuGripVertical className="text-gray-400" />}
                  </ListItemIcon>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <Checkbox
                      checked={isVisible}
                      disabled={column.alwaysVisible}
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleVisibility(column.key);
                      }}
                      sx={{
                        color: "#9CA3AF",
                        "&.Mui-checked": {
                          color: "#6C63FF",
                        },
                      }}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={column.label}
                    sx={{
                      "& .MuiListItemText-primary": {
                        fontSize: "0.875rem",
                        color: column.alwaysVisible ? "#6B7280" : "#374151",
                        fontWeight: column.alwaysVisible ? 500 : 400,
                      },
                    }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
        <Divider />
        <div className="p-2">
          <Button
            variant="contained"
            fullWidth
            onClick={handleApply}
            disabled={!hasChanges}
            sx={{
              textTransform: "none",
              backgroundColor: "#6C63FF",
              fontWeight: 600,
              boxShadow: "none",
              "&:hover": {
                backgroundColor: "#5A52E6",
                boxShadow: "0 4px 12px rgba(108, 99, 255, 0.3)",
              },
              "&.Mui-disabled": {
                backgroundColor: "#E5E7EB",
                color: "#9CA3AF",
              },
            }}
          >
            Apply Changes
          </Button>
        </div>
      </div>
    </Popover>
  );
}
