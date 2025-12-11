"use client";

import dayjs from "dayjs";
import type { User } from "~/domain/entities/user";

type UserTableProps = {
  data: User[];
  loading?: boolean;
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  ACCOUNTANT: "Accountant",
  LOGISTIC_WORKER: "Logistic Worker",
  SECURITY: "Security",
};

export default function UserTable({ data, loading = false }: UserTableProps) {
  const renderHeader = () => {
    return (
      <>
        <th className="rounded-l-lg px-4 py-3 text-left text-sm font-semibold text-gray-900">
          Name
        </th>
        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Email</th>
        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Role</th>
        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Last Login</th>
        <th className="rounded-r-lg px-4 py-3 text-left text-sm font-semibold text-gray-900">
          Created At
        </th>
      </>
    );
  };

  const renderRows = () => {
    if (loading) {
      return (
        <tr>
          <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
            Loading users...
          </td>
        </tr>
      );
    }

    if (data.length === 0) {
      return (
        <tr>
          <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
            No users found.
          </td>
        </tr>
      );
    }

    return data.map((user) => (
      <tr key={user.id} className="border-b border-gray-100 transition-colors hover:bg-gray-50">
        <td className="px-4 py-3 text-sm text-gray-700">{user.name}</td>
        <td className="px-4 py-3 text-sm text-gray-700">{user.email}</td>
        <td className="px-4 py-3 text-sm text-gray-700">{ROLE_LABELS[user.role] || user.role}</td>
        <td className="px-4 py-3">
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
              user.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
            }`}
          >
            {user.isActive ? "Active" : "Inactive"}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-gray-700">
          {user.lastLoginAt ? dayjs(user.lastLoginAt).format("DD/MM/YYYY HH:mm") : "—"}
        </td>
        <td className="px-4 py-3 text-sm text-gray-700">
          {dayjs(user.createdAt).format("DD/MM/YYYY")}
        </td>
      </tr>
    ));
  };

  return (
    <div className="rounded-lg bg-white shadow-sm">
      <div className="h-[calc(100vh-8rem)] overflow-auto px-2">
        <table className="w-full min-w-full">
          <thead className="sticky top-2 z-10">
            <tr className="bg-[#eff0fe]">{renderHeader()}</tr>
          </thead>
          <tbody>{renderRows()}</tbody>
        </table>
      </div>
    </div>
  );
}
