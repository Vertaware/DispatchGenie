"use client";

import { Button } from "@mui/material";
import { useState } from "react";
import { UserMenu } from "~/components/common";
import CreateUserModal from "./components/create-user-modal";

export default function Header() {
  const [openCreateUserModal, setOpenCreateUserModal] = useState(false);

  return (
    <div className="flex items-center justify-between px-6 py-2">
      <h1 className="text-2xl font-semibold">Users</h1>
      <div className="flex items-center gap-2">
        <Button
          variant="contained"
          color="primary"
          className="flex items-center gap-2"
          onClick={() => setOpenCreateUserModal(true)}
        >
          <span className="capitalize text-white">Add New User</span>
        </Button>
        <CreateUserModal open={openCreateUserModal} onClose={() => setOpenCreateUserModal(false)} />
        <UserMenu />
      </div>
    </div>
  );
}
