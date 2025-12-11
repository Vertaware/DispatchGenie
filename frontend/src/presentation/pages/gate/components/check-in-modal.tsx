"use client";

import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { IoClose } from "react-icons/io5";
import { checkInVehicle } from "~/infrastructure/services/gate.service";
import { gateQueryKeys } from "~/presentation/hooks/useGates";
import { useSnackbar } from "~/shared/contexts";

type CheckInModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function CheckInModal({ open, onClose }: CheckInModalProps) {
  const { showSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const [vehicleNumber, setVehicleNumber] = useState("");

  const checkInMutation = useMutation({
    mutationFn: checkInVehicle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gateQueryKeys.all });
      showSnackbar({
        message: "Vehicle checked in successfully",
        severity: "success",
      });
      setVehicleNumber("");
      onClose();
    },
    onError: (error: unknown) => {
      showSnackbar({
        message: error instanceof Error ? error.message : "Failed to check in vehicle",
        severity: "error",
      });
    },
  });

  const handleClose = () => {
    if (checkInMutation.isPending) return;
    setVehicleNumber("");
    onClose();
  };

  const handleSubmit = () => {
    if (!vehicleNumber.trim()) {
      showSnackbar({
        message: "Vehicle number is required",
        severity: "error",
      });
      return;
    }
    checkInMutation.mutate(vehicleNumber.trim());
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span>New Check-In</span>
        <button
          onClick={handleClose}
          disabled={checkInMutation.isPending}
          className="rounded p-1 text-gray-400 transition-colors hover:text-gray-600"
        >
          <IoClose className="text-xl" />
        </button>
      </DialogTitle>
      <DialogContent>
        <TextField
          label="Vehicle Number"
          required
          fullWidth
          value={vehicleNumber}
          onChange={(e) => setVehicleNumber(e.target.value)}
          disabled={checkInMutation.isPending}
          sx={{ mt: 2 }}
          helperText="Enter vehicle number to create a new Check-In entry"
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={handleClose} disabled={checkInMutation.isPending}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={checkInMutation.isPending || !vehicleNumber.trim()}
          startIcon={
            checkInMutation.isPending ? <CircularProgress size={16} color="inherit" /> : null
          }
        >
          Check In
        </Button>
      </DialogActions>
    </Dialog>
  );
}
