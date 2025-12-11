/**
 * Format frightCost value
 * If value is 0 or null/undefined, returns "RFQ"
 * Otherwise formats as currency
 */
export const formatFrightCost = (value?: number | null): string => {
  if (value === null || value === undefined || value === 0) {
    return "RFQ";
  }
  return `₹${value.toLocaleString("en-IN")}`;
};

/**
 * Format currency value
 */
export const formatCurrency = (amount?: number | null): string => {
  if (amount === null || amount === undefined) {
    return "—";
  }
  return `₹${amount.toLocaleString("en-IN")}`;
};
