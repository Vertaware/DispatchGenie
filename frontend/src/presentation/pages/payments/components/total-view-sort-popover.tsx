"use client";

import {
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Popover,
} from "@mui/material";
import { BsCheck } from "react-icons/bs";
import { IoArrowDown, IoArrowUp } from "react-icons/io5";

export type TotalViewSortOrder = "asc" | "desc";
export type TotalViewSortField = "beneficiaryName" | "status" | "totalAmount";

export interface TotalViewSortConfig {
  field: TotalViewSortField;
  order: TotalViewSortOrder;
}

type TotalViewSortPopoverProps = {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  currentSort: TotalViewSortConfig | null;
  onSortChange: (sort: TotalViewSortConfig | null) => void;
};

const SORT_FIELDS: Array<{ field: TotalViewSortField; label: string }> = [
  { field: "beneficiaryName", label: "Beneficiary Name" },
  { field: "status", label: "Status" },
  { field: "totalAmount", label: "Transaction Amount" },
];

export default function TotalViewSortPopover({
  anchorEl,
  open,
  onClose,
  currentSort,
  onSortChange,
}: TotalViewSortPopoverProps) {
  const handleSortSelect = (field: TotalViewSortField) => {
    if (currentSort?.field === field) {
      // Toggle order: asc -> desc -> clear
      if (currentSort.order === "asc") {
        onSortChange({ field, order: "desc" });
      } else {
        onSortChange(null);
      }
    } else {
      // New field, start with ascending
      onSortChange({ field, order: "asc" });
    }
    onClose();
  };

  const handleClearSort = () => {
    onSortChange(null);
    onClose();
  };

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
            minWidth: 240,
            maxHeight: 400,
            boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
            borderRadius: 2,
          },
        },
      }}
    >
      <div className="py-2">
        <div className="px-4 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Sort By</p>
        </div>
        <List disablePadding>
          {SORT_FIELDS.map((item) => {
            const isActive = currentSort?.field === item.field;
            return (
              <ListItem key={item.field} disablePadding>
                <ListItemButton onClick={() => handleSortSelect(item.field)} sx={{ py: 1 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    {isActive && <BsCheck className="text-xl font-bold text-[#6C63FF]" />}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    sx={{
                      "& .MuiListItemText-primary": {
                        fontSize: "0.875rem",
                        color: isActive ? "#6C63FF" : "#374151",
                        fontWeight: isActive ? 600 : 400,
                      },
                    }}
                  />
                  {isActive && (
                    <div className="ml-2">
                      {currentSort.order === "asc" ? (
                        <IoArrowUp className="text-[#6C63FF]" />
                      ) : (
                        <IoArrowDown className="text-[#6C63FF]" />
                      )}
                    </div>
                  )}
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
        {currentSort && (
          <>
            <Divider sx={{ my: 1 }} />
            <div className="px-2">
              <ListItemButton onClick={handleClearSort} sx={{ borderRadius: 1, py: 1 }}>
                <ListItemText
                  primary="Clear Sort"
                  sx={{
                    "& .MuiListItemText-primary": {
                      fontSize: "0.875rem",
                      color: "#EF4444",
                      fontWeight: 500,
                    },
                  }}
                />
              </ListItemButton>
            </div>
          </>
        )}
      </div>
    </Popover>
  );
}
