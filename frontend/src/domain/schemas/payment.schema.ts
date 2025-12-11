import { z } from "zod";

const PAYMENT_TRANSACTION_TYPES = [
  "ADVANCE_SHIPPING",
  "BALANCE_SHIPPING",
  "FULL_SHIPPING_CHARGES",
  "POINT_1_TO_POINT_2_TRANSFER",
  "UNLOADING_CHARGE",
  "UNLOADING_DETENTION",
  "MISCELLANEOUS_CHARGES",
] as const;

export const paymentRecordSchema = z
  .object({
    salesOrderId: z.string().min(1, "Sales order is required"),
    vehicleId: z.string().min(1, "Vehicle is required"),
    vehicleNumber: z.string().min(1, "Vehicle number is required"),
    driverName: z.string().min(1, "Driver name is required"),
    driverPhone: z.string().min(1, "Driver phone is required"),
    vehicleAmount: z.number({ required_error: "Vehicle amount is required" }).nonnegative(),
    transactionType: z.enum(PAYMENT_TRANSACTION_TYPES),
    transactionAmount: z.string().min(1, "Transaction amount is required"),
    beneficiaryId: z.string().min(1, "Beneficiary is required"),
    hasUnloadingCharge: z.boolean().optional().default(false),
    locationReachedAt: z.string().optional(),
    unloadedTime: z.string().optional(),
    podFile: z.instanceof(File).optional(),
    notes: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    const requiresPod =
      value.transactionType === "BALANCE_SHIPPING" ||
      value.transactionType === "FULL_SHIPPING_CHARGES";
    if (requiresPod && !value.podFile) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["podFile"],
        message: "POD document is required for Balance/Full Shipping",
      });
    }

    const vehicleAmount = value.vehicleAmount ?? 0;
    if (
      value.transactionType === "ADVANCE_SHIPPING" &&
      vehicleAmount > 0 &&
      Number(value.transactionAmount) >= vehicleAmount
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["transactionAmount"],
        message: `Advance Shipping amount must be less than Vehicle Amount (${vehicleAmount})`,
      });
    }
    if (value.transactionType === "MISCELLANEOUS_CHARGES" && !value.notes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["notes"],
        message: "Notes are required for Miscellaneous Charges",
      });
    }
    // Validate UNLOADING_DETENTION requires locationReachedAt and unloadedTime
    if (value.transactionType === "UNLOADING_DETENTION") {
      if (!value.locationReachedAt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["locationReachedAt"],
          message: "Location reached time is required for UNLOADING_DETENTION",
        });
      }
      if (!value.unloadedTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["unloadedTime"],
          message: "Unloaded time is required for UNLOADING_DETENTION",
        });
      }
      // Validate unloadedTime is after locationReachedAt
      if (value.locationReachedAt && value.unloadedTime) {
        const locationReachedDate = new Date(value.locationReachedAt);
        const unloadedDate = new Date(value.unloadedTime);
        if (unloadedDate < locationReachedDate) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["unloadedTime"],
            message: "Unloaded time must be after location reached time",
          });
        }
      }
    }
  });

export const completePaymentSchema = z.object({
  salesOrderId: z.string().optional(),
  vehicleNumber: z.string().optional(),
  driverName: z.string().optional(),
  driverPhone: z.string().optional(),
  vehicleAmount: z.string().optional(),
  transactionType: z.enum(PAYMENT_TRANSACTION_TYPES).optional(),
  transactionAmount: z.string().optional(),
  beneficiaryId: z.string().optional(),
  transactionIds: z.array(z.string()).min(1, "Please select at least one transaction"),
});

export type PaymentRecordForm = z.infer<typeof paymentRecordSchema>;
export type CompletePaymentForm = z.infer<typeof completePaymentSchema>;
