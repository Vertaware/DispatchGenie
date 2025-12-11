"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { getSalesOrder } from "~/infrastructure/services";
import Header from "./header";
import SalesOrderForm from "./sales-order-form";

export default function SalesOrderFormPage() {
  const { id } = useParams();
  const { data: salesOrder, isLoading } = useQuery({
    queryKey: ["getSalesOrder", id],
    queryFn: () => getSalesOrder(id as string),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex size-full min-h-screen items-center justify-center">
        <div className="flex items-center justify-center space-x-1 text-sm text-gray-700">
          <div className="size-16 animate-spin rounded-full border-8 border-gray-300 border-t-blue-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex size-full min-h-screen flex-col">
      <Header title={salesOrder?.soNumber ?? "New Sales Order"} />
      <SalesOrderForm data={salesOrder} />
    </div>
  );
}
