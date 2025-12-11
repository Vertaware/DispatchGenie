import { z } from "zod";

export const createInvoiceSchema = z.object({
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  date: z.string().min(1, "Date is required"),
  vehicleIds: z.array(z.string()).min(1, "At least one vehicle is required"),
  overrideAmount: z.number().optional(),
  invoicePdf: z
    .custom<File>((val) => val instanceof File, {
      message: "Invoice PDF is required",
    })
    .refine((file) => file && file.size > 0, {
      message: "Invoice PDF is required",
    })
    .refine((file) => file && file.type === "application/pdf", {
      message: "Only PDF files are allowed",
    }),
});

export type CreateInvoiceFormData = z.infer<typeof createInvoiceSchema>;
