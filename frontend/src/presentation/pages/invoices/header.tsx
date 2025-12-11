"use client";

import { Button } from "@mui/material";
import { IoNotificationsOutline } from "react-icons/io5";
import { UserMenu } from "~/components/common";

export default function Header() {
  return (
    <div className="flex items-center justify-between px-6 py-2">
      <h1 className="text-2xl font-semibold">Invoices</h1>
      <div className="flex items-center gap-2">
        <Button className="flex items-center justify-center">
          <IoNotificationsOutline className="text-xl" />
        </Button>
        <UserMenu />
      </div>
    </div>
  );
}
