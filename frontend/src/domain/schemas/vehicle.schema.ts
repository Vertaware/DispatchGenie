import { z } from "zod";

export const updateVehicleSchema = z
  .object({
    vehicleNumber: z.string().trim().min(1, "Vehicle number is required"),
    driverName: z.string().trim().min(1, "Driver name is required"),
    driverPhone: z.string().trim().min(1, "Driver phone number is required"),
    vehicleAmount: z.string().trim().min(1, "Vehicle amount is required"),
    placedTruckSize: z.string().trim().min(1, "Placed truck size is required"),
    placedTruckType: z.string().trim().min(1, "Placed truck type is required"),
    asmPhoneNumber: z.string().trim().min(1, "ASM phone number is required"),
    status: z.string().trim().min(1, "Status is required"),
    loadingQuantity: z.string().trim().optional(),
  })
  .refine(
    (data) => {
      // loadingQuantity is required only when status is LOADING_COMPLETE
      if (data.status === "LOADING_COMPLETE") {
        return (
          data.loadingQuantity !== undefined &&
          data.loadingQuantity !== null &&
          data.loadingQuantity.trim().length > 0
        );
      }
      return true;
    },
    {
      message: "Loading quantity is required when status is Loading Complete",
      path: ["loadingQuantity"],
    },
  );

export const assignVehicleSchema = z.object({
  vehicleNumber: z.string().trim().min(1, "Vehicle number is required"),
  driverName: z.string().trim().min(1, "Driver name is required"),
  driverPhone: z.string().trim().min(1, "Driver phone number is required"),
  placedTruckSize: z.string().trim().min(1, "Placed truck size is required"),
  placedTruckType: z.string().trim().min(1, "Placed truck type is required"),
  vehicleAmount: z.string().trim().min(1, "Vehicle amount is required"),
  asmPhoneNumber: z.string().trim().min(1, "ASM phone number is required"),
});

export type AssignVehicleFormData = z.infer<typeof assignVehicleSchema>;
export type UpdateVehicleFormData = z.infer<typeof updateVehicleSchema>;
