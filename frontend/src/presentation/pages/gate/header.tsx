"use client";

import { Button } from "@mui/material";
import { useState } from "react";
import { UserMenu } from "~/components/common";
import { UserRole } from "~/domain/enums/enum";
import useAuth from "~/presentation/hooks/useAuth";
import CheckInModal from "./components/check-in-modal";

export default function Header() {
  const [openCheckInModal, setOpenCheckInModal] = useState(false);
  const { session } = useAuth();
  const userRole = (session?.user as any)?.user?.role as UserRole | undefined;

  // Only ADMIN and SECURITY can add new check-in
  const canAddCheckIn = userRole === UserRole.ADMIN || userRole === UserRole.SECURITY;

  return (
    <div className="flex items-center justify-between px-6 py-2">
      <h1 className="text-2xl font-semibold">Gate Operations</h1>
      <div className="flex items-center gap-2">
        {canAddCheckIn && (
          <>
            <Button
              variant="contained"
              color="primary"
              className="flex items-center gap-2"
              onClick={() => setOpenCheckInModal(true)}
            >
              <span className="capitalize text-white">New Check-In</span>
            </Button>
            <CheckInModal open={openCheckInModal} onClose={() => setOpenCheckInModal(false)} />
          </>
        )}
        <UserMenu />
      </div>
    </div>
  );
}
