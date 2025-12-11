import { z } from "zod";

const baseBeneficiarySchema = z.object({
  name: z.string().trim().min(1, "Beneficiary name is required"),
  bankNameAndBranch: z.string().trim().min(1, "Bank name and branch is required"),
  ifscCode: z.string().trim().min(1, "IFSC code is required"),
  contactInfo: z.string().trim().min(1, "Contact information is required"),
  document: z.instanceof(File).optional(),
});

export const createBeneficiarySchema = baseBeneficiarySchema
  .extend({
    accountNumber: z.string().trim().min(1, "Account number is required"),
    confirmAccountNumber: z.string().trim().min(1, "Please confirm account number"),
  })
  .refine((data) => data.accountNumber === data.confirmAccountNumber, {
    message: "Account numbers must match",
    path: ["confirmAccountNumber"],
  });

export type CreateBeneficiaryForm = z.infer<typeof createBeneficiarySchema>;
