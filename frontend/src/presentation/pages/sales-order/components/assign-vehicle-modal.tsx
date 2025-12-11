"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Autocomplete,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { IoAdd, IoClose } from "react-icons/io5";
import { TRUCK_SIZES_OPTIONS, TRUCK_TYPE_OPTIONS } from "~/domain/constants/options";
import type { SalesOrder } from "~/domain/entities/sales-order";
import type { Vehicle } from "~/domain/entities/vehicle";
import { UserRole } from "~/domain/enums/enum";
import { assignVehicleSchema, type AssignVehicleFormData } from "~/domain/schemas/vehicle.schema";
import useAuth from "~/hooks/useAuth";
import {
  assignVehicle,
  searchVehicles,
  type AssignVehicleInput,
} from "~/infrastructure/services/vehicle.service";
import { FormInput, FormSelect } from "~/presentation/components/form";
import { salesOrderQueryKeys } from "~/presentation/hooks/useSalesOrders";
import { vehicleQueryKeys } from "~/presentation/hooks/useVehicles";
import { useSnackbar } from "~/shared/contexts";

// Using a simple debounce hook implementation
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

type AssignVehicleModalProps = {
  open: boolean;
  orders: SalesOrder[];
  onClose: () => void;
  onRemoveOrder?: (orderId: string) => void;
  onAssigned?: () => void;
};

export default function AssignVehicleModal({
  open,
  orders,
  onClose,
  onRemoveOrder,
  onAssigned,
}: AssignVehicleModalProps) {
  const queryClient = useQueryClient();
  const { showSnackbar } = useSnackbar();
  const { session } = useAuth();

  const [vehicleSearchTerm, setVehicleSearchTerm] = useState<string>("");
  const [vehicleOptions, setVehicleOptions] = useState<Vehicle[]>([]);
  const [vehicleSearchLoading, setVehicleSearchLoading] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const debouncedSearchTerm = useDebounce(vehicleSearchTerm, 300);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<AssignVehicleFormData>({
    mode: "onChange",
    resolver: zodResolver(assignVehicleSchema),
    defaultValues: {
      vehicleNumber: "",
      driverName: "",
      driverPhone: "",
      placedTruckSize: "",
      placedTruckType: "OPEN",
      vehicleAmount: "0",
      asmPhoneNumber: "",
    },
  });

  const assignmentMutation = useMutation({
    mutationFn: (payload: AssignVehicleInput) => assignVehicle(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: salesOrderQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: vehicleQueryKeys.all });
      showSnackbar({
        message: "Vehicle assigned successfully.",
        severity: "success",
      });
      reset();
      setVehicleSearchTerm("");
      setVehicleOptions([]);
      setSelectedVehicle(null);
      onAssigned?.();
    },
    onError: (error: unknown) => {
      const data = (error as any).response?.data?.message;
      const message = Array.isArray(data) ? data.join(", ") : (data ?? "Unable to assign vehicle.");
      showSnackbar({ message: message as string, severity: "error" });
    },
  });

  // Vehicle search effect
  useEffect(() => {
    if (!debouncedSearchTerm || debouncedSearchTerm.length < 2) {
      setVehicleOptions([]);
      return;
    }

    const performSearch = async () => {
      setVehicleSearchLoading(true);
      try {
        const results = await searchVehicles({ q: debouncedSearchTerm });
        setVehicleOptions(results);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(error);
        setVehicleOptions([]);
      } finally {
        setVehicleSearchLoading(false);
      }
    };

    performSearch();
  }, [debouncedSearchTerm]);

  // Auto-fill form when vehicle is selected
  useEffect(() => {
    if (selectedVehicle) {
      setVehicleSearchTerm(selectedVehicle.vehicleNumber || "");
      setValue("vehicleNumber", selectedVehicle.vehicleNumber || "", { shouldValidate: true });
      setValue("driverName", selectedVehicle.driverName || "", {
        shouldValidate: true,
      });
      setValue(
        "driverPhone",
        selectedVehicle.driverPhoneNumber || selectedVehicle.driverPhone || "",
        { shouldValidate: true },
      );
      setValue("placedTruckSize", selectedVehicle.placedTruckSize || "", {
        shouldValidate: true,
      });
      setValue("placedTruckType", selectedVehicle.placedTruckType || "OPEN", {
        shouldValidate: true,
      });
    }
  }, [selectedVehicle, setValue]);

  const totalQuantity = useMemo(
    () =>
      orders.reduce((sum, order) => {
        const qty = order.soCases || order.quantity;
        if (typeof qty === "number") {
          return sum + qty;
        }
        return sum;
      }, 0),
    [orders],
  );

  const onSubmit = async (data: AssignVehicleFormData) => {
    const shippingAmount = Number(data.vehicleAmount) || 0;

    const payload: AssignVehicleInput = {
      salesOrderIds: orders.map((order) => order.id),
      vehicleAmount: shippingAmount,
      driverName: data.driverName.trim(),
      vehicleNumber: data.vehicleNumber.trim(),
      driverPhoneNumber: data.driverPhone.trim(),
      placedTruckSize: data.placedTruckSize.trim(),
      placedTruckType: data.placedTruckType,
      vehicleId: selectedVehicle?.id,
      asmPhoneNumber: data.asmPhoneNumber,
    };

    await assignmentMutation.mutateAsync(payload);
  };

  const handleClose = () => {
    if (assignmentMutation.isPending) return;
    setVehicleSearchTerm("");
    setVehicleOptions([]);
    setSelectedVehicle(null);
    reset();
    onClose();
  };

  const roleGuard = () => {
    const userRole = (session?.user as any)?.user?.role as UserRole | undefined;
    return userRole === UserRole.ADMIN || userRole === UserRole.ACCOUNTANT;
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <DialogTitle>
          <div className="flex items-center justify-between">
            <div>
              <Typography variant="h5" fontWeight={700}>
                Assign Vehicle
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Enter the vehicle details for the selected sales orders.
              </Typography>
            </div>
            <IconButton onClick={handleClose} disabled={assignmentMutation.isPending}>
              <IoClose />
            </IconButton>
          </div>
        </DialogTitle>
        <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <section>
            <div className="mb-2 flex items-center justify-between">
              <Typography variant="subtitle1" fontWeight={600}>
                Sales Orders
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<IoAdd />}
                onClick={handleClose}
                disabled={assignmentMutation.isPending}
              >
                Add More Orders
              </Button>
            </div>
            <div className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3">
              {orders.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No sales orders selected.
                </Typography>
              ) : (
                orders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between gap-4 rounded-lg border border-green-200 p-3"
                  >
                    <div>
                      <Typography variant="subtitle2" fontWeight={600}>
                        SO #{order.soNumber}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {order.partyName ?? order.customerName ?? "—"}
                      </Typography>
                    </div>
                    <div className="flex flex-1 justify-around text-center">
                      <div>
                        <Typography variant="caption" color="text.secondary">
                          Location
                        </Typography>
                        <Typography variant="body2">{order.townName ?? "—"}</Typography>
                      </div>
                      <div>
                        <Typography variant="caption" color="text.secondary">
                          Quantity
                        </Typography>
                        <Typography variant="body2">{order.quantity ?? "—"} units</Typography>
                      </div>
                      <div>
                        <Typography variant="caption" color="text.secondary">
                          Truck Size
                        </Typography>
                        <Typography variant="body2">
                          {order.requestedTruckSize ? `${order.requestedTruckSize} MT` : "—"}
                        </Typography>
                      </div>
                    </div>
                    {onRemoveOrder ? (
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => onRemoveOrder(order.id)}
                        disabled={assignmentMutation.isPending}
                      >
                        <IoClose />
                      </IconButton>
                    ) : null}
                  </div>
                ))
              )}
              <div className="mt-1 flex items-center justify-between">
                <Typography variant="body2" color="text.secondary">
                  {orders.length} order(s) selected
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  Total: {totalQuantity} units
                </Typography>
              </div>
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <Typography variant="subtitle1" fontWeight={600}>
                Vehicle Details
              </Typography>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <Controller
                  name="vehicleNumber"
                  control={control}
                  render={({ field }) => (
                    <Autocomplete
                      freeSolo
                      options={vehicleOptions}
                      getOptionLabel={(option) =>
                        typeof option === "string" ? option : option.vehicleNumber || ""
                      }
                      loading={vehicleSearchLoading}
                      value={selectedVehicle}
                      inputValue={vehicleSearchTerm}
                      onInputChange={(_, newInputValue) => {
                        setVehicleSearchTerm(newInputValue);
                        field.onChange(newInputValue);
                        if (!newInputValue) {
                          setSelectedVehicle(null);
                        } else {
                          setSelectedVehicle(null);
                        }
                      }}
                      onChange={(_, newValue) => {
                        if (typeof newValue === "object" && newValue) {
                          setSelectedVehicle(newValue);
                          setVehicleSearchTerm(newValue.vehicleNumber);
                          field.onChange(newValue.vehicleNumber);
                        } else if (typeof newValue === "string" && newValue.trim()) {
                          setSelectedVehicle(null);
                          setVehicleSearchTerm(newValue);
                          field.onChange(newValue);
                        } else {
                          setSelectedVehicle(null);
                        }
                      }}
                      noOptionsText={
                        vehicleSearchTerm.length < 2
                          ? "Type at least 2 characters to search"
                          : "No vehicles found"
                      }
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Vehicle Number"
                          required
                          error={!!errors.vehicleNumber}
                          helperText={errors.vehicleNumber?.message}
                          InputProps={{
                            ...params.InputProps,
                            endAdornment: (
                              <>
                                {vehicleSearchLoading ? <CircularProgress size={20} /> : null}
                                {params.InputProps.endAdornment}
                              </>
                            ),
                          }}
                        />
                      )}
                      renderOption={(props, option) => (
                        <li {...props} key={option.id}>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium">{option.vehicleNumber}</span>
                            {option.driverName && (
                              <span className="text-sm text-gray-500">
                                Driver: {option.driverName}
                              </span>
                            )}
                          </div>
                        </li>
                      )}
                    />
                  )}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormInput
                  control={control}
                  name="driverName"
                  label="Driver Name"
                  required
                  disabled={assignmentMutation.isPending}
                  error={!!errors.driverName}
                  helperText={errors.driverName?.message}
                />
                <FormInput
                  control={control}
                  name="driverPhone"
                  label="Driver Phone Number"
                  required
                  disabled={assignmentMutation.isPending}
                  error={!!errors.driverPhone}
                  helperText={errors.driverPhone?.message}
                />
                <FormSelect
                  control={control}
                  name="placedTruckSize"
                  label="Placed Truck Size"
                  size="small"
                  options={TRUCK_SIZES_OPTIONS}
                  disabled={assignmentMutation.isPending}
                  error={!!errors.placedTruckSize}
                  helperText={errors.placedTruckSize?.message}
                />
                <FormSelect
                  control={control}
                  name="placedTruckType"
                  label="Placed Truck Type"
                  size="small"
                  options={TRUCK_TYPE_OPTIONS}
                  disabled={assignmentMutation.isPending}
                  error={!!errors.placedTruckType}
                  helperText={errors.placedTruckType?.message}
                />
                {roleGuard() && (
                  <FormInput
                    control={control}
                    name="vehicleAmount"
                    label="Vehicle Amount"
                    type="number"
                    required
                    disabled={assignmentMutation.isPending}
                    error={!!errors.vehicleAmount}
                    helperText={errors.vehicleAmount?.message}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                    }}
                  />
                )}
                <FormInput
                  control={control}
                  name="asmPhoneNumber"
                  label="ASM Phone Number"
                  type="number"
                  required
                  disabled={assignmentMutation.isPending}
                  error={!!errors.asmPhoneNumber}
                  helperText={errors.asmPhoneNumber?.message}
                />
              </div>
            </div>
          </section>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleClose} disabled={assignmentMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="contained"
            type="submit"
            disabled={assignmentMutation.isPending}
            sx={{ minWidth: 120 }}
          >
            {assignmentMutation.isPending ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              "Submit"
            )}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
