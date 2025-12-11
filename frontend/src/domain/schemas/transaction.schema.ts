import { z } from "zod";

export const transactionRecordSchema = z.object({
  transactionCode: z.string().min(1, "Transaction code is required"),
  transactionDate: z.string().min(1, "Transaction date is required"),
  totalPaidAmount: z.string().min(1, "Total paid amount is required"),
  beneficiaryId: z.string().min(1, "Beneficiary is required"),
  paymentProof: z.instanceof(File, { message: "Payment proof document is required" }),
});

export type TransactionRecordForm = z.infer<typeof transactionRecordSchema>;
