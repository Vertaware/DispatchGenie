import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().email("Invalid email address").trim().min(1, "Email is required"),
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be at most 100 characters"),
  role: z.enum(["ADMIN", "ACCOUNTANT", "LOGISTIC_WORKER", "SECURITY"], {
    required_error: "Role is required",
  }),
});

export type CreateUserFormData = z.infer<typeof createUserSchema>;
