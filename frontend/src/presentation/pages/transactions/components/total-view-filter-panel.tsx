"use client";

import {
  Button,
  Divider,
  FormControl,
  IconButton,
  MenuItem,
  Popover,
  Select,
  TextField,
} from "@mui/material";
import { useEffect, useState } from "react";
import { IoAdd, IoClose, IoTrash } from "react-icons/io5";

export type TotalViewFilters = {
  beneficiaryName?: string;
  totalPaidAmount?: {
    operator: "equals" | "greaterThan" | "lessThan" | "greaterThanOrEqual" | "lessThanOrEqual";
    value: number;
  };
  remainingBalance?: {
    operator: "equals" | "greaterThan" | "lessThan" | "greaterThanOrEqual" | "lessThanOrEqual";
    value: number;
  };
};

export type TotalViewFilterCondition = {
  id: string;
  field: "beneficiaryName" | "totalPaidAmount" | "remainingBalance";
  operator: string;
  value: string | number;
};

type TotalViewFilterPanelProps = {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  currentFilters: TotalViewFilters;
  onApply: (filters: TotalViewFilters) => void;
  onClear: () => void;
};

type FilterField = {
  key: "beneficiaryName" | "totalPaidAmount" | "remainingBalance";
  label: string;
  type: "text" | "number";
  icon?: React.ReactNode;
};

const FILTER_FIELDS: FilterField[] = [
  {
    key: "beneficiaryName",
    label: "Beneficiary Name",
    type: "text",
  },
  {
    key: "totalPaidAmount",
    label: "Total Paid Amount",
    type: "number",
  },
  {
    key: "remainingBalance",
    label: "Remaining Balance",
    type: "number",
  },
];

const OPERATORS: Record<string, Array<{ value: string; label: string }>> = {
  text: [
    { value: "equals", label: "equals" },
    { value: "contains", label: "contains" },
    { value: "startsWith", label: "starts with" },
    { value: "endsWith", label: "ends with" },
  ],
  number: [
    { value: "equals", label: "=" },
    { value: "greaterThan", label: ">" },
    { value: "lessThan", label: "<" },
    { value: "greaterThanOrEqual", label: ">=" },
    { value: "lessThanOrEqual", label: "<=" },
  ],
};

export default function TotalViewFilterPanel({
  anchorEl,
  open,
  onClose,
  currentFilters,
  onApply,
  onClear,
}: TotalViewFilterPanelProps) {
  const [conditions, setConditions] = useState<TotalViewFilterCondition[]>([]);

  useEffect(() => {
    if (open) {
      const initialConditions: TotalViewFilterCondition[] = [];

      if (currentFilters.beneficiaryName) {
        initialConditions.push({
          id: `beneficiaryName-${Date.now()}`,
          field: "beneficiaryName",
          operator: "contains",
          value: currentFilters.beneficiaryName,
        });
      }

      if (currentFilters.totalPaidAmount) {
        initialConditions.push({
          id: `totalPaidAmount-${Date.now()}`,
          field: "totalPaidAmount",
          operator: currentFilters.totalPaidAmount.operator,
          value: currentFilters.totalPaidAmount.value,
        });
      }

      if (currentFilters.remainingBalance) {
        initialConditions.push({
          id: `remainingBalance-${Date.now()}`,
          field: "remainingBalance",
          operator: currentFilters.remainingBalance.operator,
          value: currentFilters.remainingBalance.value,
        });
      }

      setConditions(initialConditions.length > 0 ? initialConditions : [createEmptyCondition()]);
    }
  }, [open, currentFilters]);

  const createEmptyCondition = (): TotalViewFilterCondition => ({
    id: `condition-${Date.now()}-${Math.random()}`,
    field: "beneficiaryName",
    operator: "",
    value: "",
  });

  const handleAddCondition = () => {
    setConditions([...conditions, createEmptyCondition()]);
  };

  const handleRemoveCondition = (id: string) => {
    const newConditions = conditions.filter((c) => c.id !== id);
    if (newConditions.length === 0) {
      setConditions([createEmptyCondition()]);
    } else {
      setConditions(newConditions);
    }
  };

  const handleFieldChange = (
    id: string,
    field: "beneficiaryName" | "totalPaidAmount" | "remainingBalance",
  ) => {
    const fieldConfig = FILTER_FIELDS.find((f) => f.key === field);
    const defaultOperator = fieldConfig ? OPERATORS[fieldConfig.type][0]?.value || "" : "";

    setConditions(
      conditions.map((c) =>
        c.id === id
          ? {
              ...c,
              field,
              operator: defaultOperator,
              value: fieldConfig?.type === "number" ? 0 : "",
            }
          : c,
      ),
    );
  };

  const handleOperatorChange = (id: string, operator: string) => {
    setConditions(conditions.map((c) => (c.id === id ? { ...c, operator } : c)));
  };

  const handleValueChange = (id: string, value: string | number) => {
    setConditions(conditions.map((c) => (c.id === id ? { ...c, value } : c)));
  };

  const handleApply = () => {
    const filters: TotalViewFilters = {};

    conditions.forEach((condition) => {
      if (!condition.field || !condition.operator) return;

      const fieldConfig = FILTER_FIELDS.find((f) => f.key === condition.field);
      if (!fieldConfig) return;

      if (fieldConfig.type === "text" && typeof condition.value === "string" && condition.value) {
        if (condition.field === "beneficiaryName") {
          filters.beneficiaryName = condition.value;
        }
      } else if (
        fieldConfig.type === "number" &&
        typeof condition.value === "number" &&
        condition.value !== undefined
      ) {
        const operator = condition.operator as
          | "equals"
          | "greaterThan"
          | "lessThan"
          | "greaterThanOrEqual"
          | "lessThanOrEqual";
        if (condition.field === "totalPaidAmount") {
          filters.totalPaidAmount = {
            operator,
            value: condition.value,
          };
        } else if (condition.field === "remainingBalance") {
          filters.remainingBalance = {
            operator,
            value: condition.value,
          };
        }
      }
    });

    onApply(filters);
  };

  const handleClearAll = () => {
    setConditions([createEmptyCondition()]);
    onClear();
  };

  const getFieldConfig = (fieldKey: string) => FILTER_FIELDS.find((f) => f.key === fieldKey);
  const getOperatorsForField = (fieldKey: string) => {
    const fieldConfig = getFieldConfig(fieldKey);
    return fieldConfig ? OPERATORS[fieldConfig.type] || [] : [];
  };

  const hasActiveFilters = conditions.some(
    (c) => c.field && c.operator && (typeof c.value === "number" ? c.value !== undefined : c.value),
  );

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
            width: 520,
            maxHeight: "80vh",
            mt: 1,
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            borderRadius: 2,
          },
        },
      }}
    >
      <div className="flex flex-col bg-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-base font-semibold text-gray-900">Filters</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close filters"
          >
            <IoClose className="text-lg" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto px-4 py-3" style={{ maxHeight: "calc(80vh - 120px)" }}>
          <div className="flex flex-col gap-3">
            {conditions.map((condition) => {
              const fieldConfig = getFieldConfig(condition.field);
              const operators = getOperatorsForField(condition.field);
              const isNumber = fieldConfig?.type === "number";

              return (
                <div key={condition.id} className="flex items-start gap-2">
                  {/* Field Select */}
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <Select
                      value={condition.field}
                      onChange={(e) =>
                        handleFieldChange(
                          condition.id,
                          e.target.value as
                            | "beneficiaryName"
                            | "totalPaidAmount"
                            | "remainingBalance",
                        )
                      }
                      displayEmpty
                      sx={{
                        backgroundColor: "#F9FAFB",
                        "& .MuiOutlinedInput-notchedOutline": {
                          borderColor: "#E5E7EB",
                        },
                      }}
                    >
                      {FILTER_FIELDS.map((field) => (
                        <MenuItem key={field.key} value={field.key}>
                          <div className="flex items-center gap-2">
                            {field.icon}
                            <span>{field.label}</span>
                          </div>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {/* Operator Select */}
                  {condition.field && (
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                      <Select
                        value={condition.operator}
                        onChange={(e) => handleOperatorChange(condition.id, e.target.value)}
                        sx={{
                          backgroundColor: "#F9FAFB",
                          "& .MuiOutlinedInput-notchedOutline": {
                            borderColor: "#E5E7EB",
                          },
                        }}
                      >
                        {operators.map((op) => (
                          <MenuItem key={op.value} value={op.value}>
                            {op.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}

                  {/* Value Input */}
                  {condition.field && condition.operator && (
                    <div className="flex-1">
                      <TextField
                        fullWidth
                        size="small"
                        value={condition.value}
                        onChange={(e) => {
                          const value = isNumber ? parseFloat(e.target.value) || 0 : e.target.value;
                          handleValueChange(condition.id, value);
                        }}
                        type={isNumber ? "number" : "text"}
                        placeholder="Enter value"
                        sx={{
                          backgroundColor: "#F9FAFB",
                          "& .MuiOutlinedInput-root": {
                            "& fieldset": {
                              borderColor: "#E5E7EB",
                            },
                          },
                        }}
                      />
                    </div>
                  )}

                  {/* Delete Button */}
                  <IconButton
                    size="small"
                    onClick={() => handleRemoveCondition(condition.id)}
                    sx={{
                      color: "#9CA3AF",
                      "&:hover": {
                        backgroundColor: "#F3F4F6",
                        color: "#EF4444",
                      },
                    }}
                  >
                    <IoTrash className="text-lg" />
                  </IconButton>
                </div>
              );
            })}

            {/* Add Condition Button */}
            <Button
              startIcon={<IoAdd />}
              onClick={handleAddCondition}
              sx={{
                textTransform: "none",
                color: "#10B981",
                fontWeight: 500,
                justifyContent: "flex-start",
                "&:hover": {
                  backgroundColor: "#ECFDF5",
                },
              }}
            >
              Add Condition
            </Button>
          </div>
        </div>

        {/* Footer */}
        <Divider />
        <div className="flex items-center gap-3 px-4 py-3">
          <Button
            variant="outlined"
            fullWidth
            onClick={handleClearAll}
            disabled={!hasActiveFilters}
            sx={{
              textTransform: "none",
              borderColor: "#E5E7EB",
              color: "#6B7280",
              fontWeight: 500,
              "&:hover": {
                borderColor: "#9CA3AF",
                backgroundColor: "#F9FAFB",
              },
              "&.Mui-disabled": {
                borderColor: "#E5E7EB",
                color: "#D1D5DB",
              },
            }}
          >
            Clear All
          </Button>
          <Button
            variant="contained"
            fullWidth
            onClick={handleApply}
            sx={{
              textTransform: "none",
              backgroundColor: "#6C63FF",
              fontWeight: 600,
              boxShadow: "none",
              "&:hover": {
                backgroundColor: "#5A52E6",
                boxShadow: "0 4px 12px rgba(108, 99, 255, 0.3)",
              },
            }}
          >
            Apply Filters
          </Button>
        </div>
      </div>
    </Popover>
  );
}
