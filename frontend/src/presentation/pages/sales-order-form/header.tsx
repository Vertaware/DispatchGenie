"use client";

import { Breadcrumbs, Typography } from "@mui/material";
import Link from "next/link";
import { UserMenu } from "~/components/common";

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 py-2">
      <Breadcrumbs aria-label="breadcrumb">
        <Link href="/sales-orders" className="text-gray-500 hover:underline">
          Sales Orders
        </Link>
        <Typography sx={{ color: "text.primary" }}>{title}</Typography>
      </Breadcrumbs>
      <UserMenu />
    </div>
  );
}
