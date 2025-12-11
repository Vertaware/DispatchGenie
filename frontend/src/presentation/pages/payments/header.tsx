"use client";

import { Button } from "@mui/material";
import { useState } from "react";
import { IoAdd, IoNotificationsOutline } from "react-icons/io5";
import { UserMenu } from "~/components/common";
import PaymentRecordModal from "./components/payment-record-modal";

export default function Header() {
  const [openCreateOrderModal, setOpenCreateOrderModal] = useState(false);

  return (
    <div className="flex items-center justify-between px-6 py-2">
      <h1 className="text-2xl font-semibold">Payment Records</h1>
      <div className="flex items-center gap-2">
        <Button
          variant="contained"
          color="primary"
          className="flex items-center gap-2 bg-[#6C63FF] hover:bg-[#5a52e6]"
          onClick={() => setOpenCreateOrderModal(true)}
          startIcon={<IoAdd className="text-white" />}
        >
          <span className="capitalize text-white">Add New Payment</span>
        </Button>
        <PaymentRecordModal
          open={openCreateOrderModal}
          onClose={() => setOpenCreateOrderModal(false)}
        />
        <Button className="flex items-center justify-center">
          <IoNotificationsOutline className="text-xl" />
        </Button>
        <UserMenu />
      </div>
    </div>
  );
}
