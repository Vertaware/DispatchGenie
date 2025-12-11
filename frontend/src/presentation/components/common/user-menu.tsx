"use client";

import { Avatar, Button, CircularProgress, Menu, MenuItem } from "@mui/material";
import React, { useState } from "react";
import { IoLogOutOutline } from "react-icons/io5";
import useAuth from "~/hooks/useAuth";

interface UserMenuProps {
  userName?: string;
  userAvatar?: string;
}

export default function UserMenu({ userName, userAvatar }: UserMenuProps) {
  const { logout, session } = useAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      handleClose();
      await logout();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      setIsLoggingOut(false);
    }
  };

  const displayName = userName ?? session?.user?.name ?? session?.user?.email ?? "User";
  const avatarSrc = userAvatar ?? "/images/avatar.png";

  return (
    <>
      <Button
        id="user-menu-button"
        aria-controls={open ? "user-menu" : undefined}
        aria-haspopup="true"
        aria-expanded={open ? "true" : undefined}
        onClick={handleClick}
        disabled={isLoggingOut}
      >
        <Avatar alt={displayName} src={avatarSrc} />
      </Button>
      <Menu
        id="user-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        slotProps={{
          list: {
            "aria-labelledby": "user-menu-button",
          },
        }}
      >
        <MenuItem className="gap-2 !text-red-500" onClick={handleLogout} disabled={isLoggingOut}>
          {isLoggingOut ? (
            <>
              <CircularProgress size={16} color="inherit" />
              <span>Logging out...</span>
            </>
          ) : (
            <>
              <IoLogOutOutline className="text-lg" />
              <span>Logout</span>
            </>
          )}
        </MenuItem>
      </Menu>
    </>
  );
}
