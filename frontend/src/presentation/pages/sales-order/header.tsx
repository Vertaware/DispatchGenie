"use client";

import { Button } from "@mui/material";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import React, { useState } from "react";
import { UserMenu } from "~/components/common";
import CreateOrderModal from "./components/create-order-modal";
import ImportExcelModel from "./components/import-excel-model";

export default function Header() {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const [openCreateOrderModal, setOpenCreateOrderModal] = useState(false);
  const [openImportExcelModel, setOpenImportExcelModel] = useState(false);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <div className="flex items-center justify-between px-6 py-2">
      <h1 className="text-2xl font-semibold">Sales Order</h1>
      <div className="flex items-center gap-2">
        <Button
          variant="contained"
          color="primary"
          className="flex items-center gap-2"
          onClick={handleClick}
        >
          <span className="capitalize text-white">Add New Order</span>
        </Button>
        <Menu
          id="create-order-menu"
          anchorEl={anchorEl}
          open={open}
          onClose={handleClose}
          slotProps={{
            list: {
              "aria-labelledby": "basic-button",
            },
          }}
        >
          <MenuItem
            onClick={() => {
              setOpenImportExcelModel(true);
              handleClose();
            }}
          >
            Import Orders
          </MenuItem>
          <MenuItem
            onClick={() => {
              setOpenCreateOrderModal(true);
              handleClose();
            }}
          >
            Enter Manually
          </MenuItem>
        </Menu>
        <CreateOrderModal
          open={openCreateOrderModal}
          onClose={() => setOpenCreateOrderModal(false)}
        />
        <ImportExcelModel
          open={openImportExcelModel}
          onClose={() => setOpenImportExcelModel(false)}
        />
        <UserMenu />
      </div>
    </div>
  );
}
