import { z } from "zod";

const salesOrderArticleSchema = z.object({
  articleId: z.string().nullable().optional(),
  articleDescription: z.string().nullable().optional(),
  articleQuantity: z.string().nullable().optional(),
});

export const createSalesOrderSchema = z.object({
  soNumber: z.string().trim().min(1, "Sales order number is required"),
  soDate: z.string().min(1, "Sales order date is required"),
  articleDescription: z.string().optional(),
  soCases: z.string().optional(),
  caseLot: z.string().optional(),
  townName: z.string().optional(),
  pinCode: z.string().optional(),
  requestedTruckSize: z.string().optional(),
  requestedTruckType: z.string().optional(),
  articles: z.array(salesOrderArticleSchema).optional(),
});

export type CreateSalesOrderFormData = z.infer<typeof createSalesOrderSchema>;
