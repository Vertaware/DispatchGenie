"use client";

import {
  Button,
  Chip,
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
import type { SalesOrderFilters } from "~/infrastructure/services/sales-order.service";

type FilterPanelProps = {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  currentFilters: SalesOrderFilters;
  onApply: (filters: SalesOrderFilters) => void;
  onClear: () => void;
};

export type FilterCondition = {
  id: string;
  field: string;
  operator: string;
  value: string | string[];
};

type FilterField = {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "multiselect";
  options?: Array<{ value: string; label: string }>;
  icon?: React.ReactNode;
};

const FILTER_FIELDS: FilterField[] = [
  {
    key: "status",
    label: "SO Status",
    type: "multiselect",
    options: [
      { value: "PENDING", label: "Pending" },
      { value: "VEHICLE_ASSIGNED", label: "Vehicle Assigned" },
      { value: "IN_JOURNEY", label: "In Journey" },
      { value: "COMPLETED", label: "Completed" },
      { value: "CANCELLED", label: "Cancelled" },
    ],
    icon: <div className="size-2 rounded-full bg-gray-400" />,
  },
  {
    key: "soNumber",
    label: "SO Number",
    type: "text",
  },
  {
    key: "customerId",
    label: "Customer ID",
    type: "text",
  },
  {
    key: "partyName",
    label: "Party Name",
    type: "text",
  },
  {
    key: "townName",
    label: "Location",
    type: "text",
  },
  {
    key: "sku",
    label: "SKU",
    type: "text",
  },
  {
    key: "quantity",
    label: "Quantity",
    type: "number",
  },
  {
    key: "requestedTruckSize",
    label: "Truck Size",
    type: "text",
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
  select: [
    { value: "equals", label: "equals" },
    { value: "notEquals", label: "not equals" },
  ],
  multiselect: [
    { value: "isAnyOf", label: "is any of" },
    { value: "isNoneOf", label: "is none of" },
  ],
};

export default function FilterPanel({
  anchorEl,
  open,
  onClose,
  currentFilters,
  onApply,
  onClear,
}: FilterPanelProps) {
  const [conditions, setConditions] = useState<FilterCondition[]>([]);
  const [matchType, setMatchType] = useState<"AND" | "OR">("AND");

  useEffect(() => {
    if (open) {
      // Initialize conditions from current filters
      const initialConditions: FilterCondition[] = [];

      // Parse status filter
      if (currentFilters.status) {
        const statusValues = Array.isArray(currentFilters.status)
          ? currentFilters.status
          : [currentFilters.status];
        initialConditions.push({
          id: `status-${Date.now()}`,
          field: "status",
          operator: "isAnyOf",
          value: statusValues,
        });
      }

      // Parse search filter
      if (currentFilters.search) {
        initialConditions.push({
          id: `search-${Date.now()}`,
          field: "soNumber",
          operator: "contains",
          value: currentFilters.search,
        });
      }

      // Parse other filters
      Object.entries(currentFilters).forEach(([key, value]) => {
        if (key === "status" || key === "search" || key === "fromDate" || key === "toDate") {
          return; // Already handled
        }
        if (value && (typeof value === "string" || typeof value === "number")) {
          const fieldConfig = FILTER_FIELDS.find((f) => f.key === key);
          if (fieldConfig) {
            initialConditions.push({
              id: `${key}-${Date.now()}`,
              field: key,
              operator: fieldConfig.type === "number" ? "equals" : "contains",
              value: String(value),
            });
          }
        }
      });

      setConditions(initialConditions.length > 0 ? initialConditions : [createEmptyCondition()]);
    }
  }, [open, currentFilters]);

  const createEmptyCondition = (): FilterCondition => ({
    id: `condition-${Date.now()}-${Math.random()}`,
    field: "",
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

  const handleFieldChange = (id: string, field: string) => {
    const fieldConfig = FILTER_FIELDS.find((f) => f.key === field);
    const defaultOperator = fieldConfig ? OPERATORS[fieldConfig.type][0]?.value || "" : "";

    setConditions(
      conditions.map((c) =>
        c.id === id
          ? {
              ...c,
              field,
              operator: defaultOperator,
              value: fieldConfig?.type === "multiselect" ? [] : "",
            }
          : c,
      ),
    );
  };

  const handleOperatorChange = (id: string, operator: string) => {
    setConditions(conditions.map((c) => (c.id === id ? { ...c, operator } : c)));
  };

  const handleValueChange = (id: string, value: string | string[]) => {
    setConditions(conditions.map((c) => (c.id === id ? { ...c, value } : c)));
  };

  /* const _handleMultiselectToggle = (id: string, optionValue: string) => {
    setConditions(
      conditions.map((c) => {
        if (c.id !== id) return c;
        const currentValues = Array.isArray(c.value) ? c.value : [];
        const newValues = currentValues.includes(optionValue)
          ? currentValues.filter((v) => v !== optionValue)
          : [...currentValues, optionValue];
        return { ...c, value: newValues };
      }),
    );
  }; */

  const handleApply = () => {
    const filters: SalesOrderFilters = {};

    conditions.forEach((condition) => {
      if (!condition.field || !condition.operator) return;

      const fieldConfig = FILTER_FIELDS.find((f) => f.key === condition.field);
      if (!fieldConfig) return;

      // Handle multiselect fields (like status)
      if (
        fieldConfig.type === "multiselect" &&
        Array.isArray(condition.value) &&
        condition.value.length > 0
      ) {
        if (matchType === "OR" && conditions.length > 1) {
          // For OR logic with multiple conditions, we need to handle it differently
          // For now, we'll use the first condition's values
          if (!filters[condition.field]) {
            filters[condition.field] = condition.value;
          } else {
            // Combine values for OR logic
            const existing = Array.isArray(filters[condition.field])
              ? (filters[condition.field] as string[])
              : [filters[condition.field] as string];
            filters[condition.field] = [...new Set([...existing, ...condition.value])];
          }
        } else {
          filters[condition.field] = condition.value;
        }
      }
      // Handle text/number fields
      else if (fieldConfig.type !== "multiselect" && condition.value) {
        const value = condition.value as string;

        // Handle search field (special case for soNumber with contains operator)
        if (condition.field === "soNumber" && condition.operator === "contains") {
          filters.search = value;
        }
        // Handle other operators for text fields
        else if (fieldConfig.type === "text") {
          switch (condition.operator) {
            case "equals":
              filters[condition.field] = value;
              break;
            case "contains":
              filters[condition.field] = value; // Backend handles contains by default
              break;
            case "startsWith":
              // Backend doesn't support startsWith directly, use contains for now
              filters[condition.field] = value;
              break;
            case "endsWith":
              // Backend doesn't support endsWith directly, use contains for now
              filters[condition.field] = value;
              break;
            default:
              filters[condition.field] = value;
          }
        }
        // Handle number fields
        else if (fieldConfig.type === "number") {
          filters[condition.field] = value;
        }
      }
    });

    // Apply filters as a structured object
    onApply(filters);
  };

  const handleClearAll = () => {
    setConditions([createEmptyCondition()]);
    setMatchType("AND");
    onClear();
  };

  const getFieldConfig = (fieldKey: string) => FILTER_FIELDS.find((f) => f.key === fieldKey);
  const getOperatorsForField = (fieldKey: string) => {
    const fieldConfig = getFieldConfig(fieldKey);
    return fieldConfig ? OPERATORS[fieldConfig.type] || [] : [];
  };

  const hasActiveFilters = conditions.some(
    (c) => c.field && c.operator && (Array.isArray(c.value) ? c.value.length > 0 : c.value),
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
              const isMultiselect = fieldConfig?.type === "multiselect";
              const selectedValues = Array.isArray(condition.value) ? condition.value : [];

              return (
                <div key={condition.id} className="flex items-start gap-2">
                  {/* Field Select */}
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <Select
                      value={condition.field}
                      onChange={(e) => handleFieldChange(condition.id, e.target.value)}
                      displayEmpty
                      sx={{
                        backgroundColor: "#F9FAFB",
                        "& .MuiOutlinedInput-notchedOutline": {
                          borderColor: "#E5E7EB",
                        },
                      }}
                    >
                      <MenuItem value="" disabled>
                        <span className="text-gray-400">Select field</span>
                      </MenuItem>
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
                      {isMultiselect ? (
                        <FormControl size="small" fullWidth>
                          <Select
                            multiple
                            value={selectedValues}
                            onChange={(e) => {
                              const value = e.target.value;
                              handleValueChange(
                                condition.id,
                                typeof value === "string" ? value.split(",") : value,
                              );
                            }}
                            displayEmpty
                            renderValue={(selected) => {
                              if (selected.length === 0) {
                                return <span className="text-gray-400">Select values</span>;
                              }
                              return (
                                <div className="flex flex-wrap gap-1">
                                  {selected.map((value) => {
                                    const option = fieldConfig.options?.find(
                                      (opt) => opt.value === value,
                                    );
                                    return (
                                      <Chip
                                        key={value}
                                        label={option?.label || value}
                                        size="small"
                                        sx={{
                                          backgroundColor: "#6C63FF",
                                          color: "#FFFFFF",
                                          fontWeight: 500,
                                          height: "24px",
                                          "& .MuiChip-label": {
                                            padding: "0 8px",
                                          },
                                        }}
                                      />
                                    );
                                  })}
                                </div>
                              );
                            }}
                            sx={{
                              backgroundColor: "#F9FAFB",
                              "& .MuiOutlinedInput-notchedOutline": {
                                borderColor: "#E5E7EB",
                              },
                            }}
                          >
                            {fieldConfig.options?.map((option) => {
                              const isSelected = selectedValues.includes(option.value);
                              return (
                                <MenuItem key={option.value} value={option.value}>
                                  <div className="flex w-full items-center gap-2">
                                    <div
                                      className={`size-2 rounded-full ${
                                        isSelected ? "bg-[#6C63FF]" : "bg-gray-400"
                                      }`}
                                    />
                                    <span
                                      className={
                                        isSelected
                                          ? "font-semibold text-[#6C63FF]"
                                          : "text-gray-700"
                                      }
                                    >
                                      {option.label}
                                    </span>
                                  </div>
                                </MenuItem>
                              );
                            })}
                          </Select>
                        </FormControl>
                      ) : (
                        <TextField
                          fullWidth
                          size="small"
                          value={condition.value}
                          onChange={(e) => handleValueChange(condition.id, e.target.value)}
                          type={fieldConfig?.type === "number" ? "number" : "text"}
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
                      )}
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

            {/* Match Type Selector */}
            {conditions.length > 1 && (
              <div className="mt-2">
                <FormControl size="small" fullWidth>
                  <Select
                    value={matchType}
                    onChange={(e) => setMatchType(e.target.value as "AND" | "OR")}
                    sx={{
                      backgroundColor: "#F9FAFB",
                      "& .MuiOutlinedInput-notchedOutline": {
                        borderColor: "#E5E7EB",
                      },
                    }}
                  >
                    <MenuItem value="AND">Match All Conditions (AND)</MenuItem>
                    <MenuItem value="OR">Match Any Conditions (OR)</MenuItem>
                  </Select>
                </FormControl>
              </div>
            )}
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
