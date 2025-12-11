import { z } from "zod";

export const markInvoicePaidSchema = z.object({
  paidAmount: z.number().min(0.01, "Paid amount must be greater than 0"),
  paidDate: z.string().min(1, "Paid date is required"),
});

export type MarkInvoicePaidFormData = z.infer<typeof markInvoicePaidSchema>;
