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

export interface ColumnConfig {
  key: string;
  label: string;
  sortField?: string;
  alwaysVisible?: boolean;
  visible?: boolean;
}

export const DEFAULT_COLUMNS: ColumnConfig[] = [
  {
    key: "name",
    label: "Beneficiary's Name",
    sortField: "name",
    alwaysVisible: true,
  },
  { key: "accountNumber", label: "Account Number", sortField: "accountNumber" },
  {
    key: "bankNameAndBranch",
    label: "Bank Name and Branch",
    sortField: "bankNameAndBranch",
  },
  { key: "ifscCode", label: "IFSC Code", sortField: "ifscCode" },
  {
    key: "contactInfo",
    label: "Contact Information",
    sortField: "contactInfo",
  },
  { key: "document", label: "Document", sortField: "document" },
];

type ColumnsPopoverProps = {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  columns: ColumnConfig[];
  onColumnsChange: (columns: ColumnConfig[]) => void;
};

export default function ColumnsPopover({
  anchorEl,
  open,
  onClose,
  columns,
  onColumnsChange,
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
    setLocalColumns(DEFAULT_COLUMNS.map((col) => ({ ...col, visible: true })));
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
