"use client";

import { Alert, AlertColor, Snackbar } from "@mui/material";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

interface SnackbarOptions {
  message: string;
  severity?: AlertColor;
  duration?: number;
}

interface SnackbarContextValue {
  showSnackbar: (_options: SnackbarOptions) => void;
  hideSnackbar: () => void;
}

interface SnackbarState extends SnackbarOptions {
  open: boolean;
}

const SnackbarContext = createContext<SnackbarContextValue | undefined>(undefined);

const DEFAULT_STATE: SnackbarState = {
  message: "",
  severity: "info",
  duration: 4000,
  open: false,
};

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [snackbarState, setSnackbarState] = useState<SnackbarState>(DEFAULT_STATE);

  const hideSnackbar = useCallback(() => {
    setSnackbarState((prev) => ({
      ...prev,
      open: false,
    }));
  }, []);

  const showSnackbar = useCallback((options: SnackbarOptions) => {
    setSnackbarState({
      open: true,
      message: options.message,
      severity: options.severity ?? "info",
      duration: options.duration ?? 4000,
    });
  }, []);

  const value = useMemo<SnackbarContextValue>(
    () => ({
      showSnackbar,
      hideSnackbar,
    }),
    [hideSnackbar, showSnackbar],
  );

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      <Snackbar
        open={snackbarState.open}
        autoHideDuration={snackbarState.duration}
        onClose={hideSnackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          elevation={6}
          variant="filled"
          severity={snackbarState.severity}
          onClose={hideSnackbar}
          sx={{ width: "100%" }}
        >
          {snackbarState.message}
        </Alert>
      </Snackbar>
    </SnackbarContext.Provider>
  );
}

export function useSnackbar(): SnackbarContextValue {
  const context = useContext(SnackbarContext);
  if (!context) {
    throw new Error("useSnackbar must be used within a SnackbarProvider");
  }
  return context;
}
