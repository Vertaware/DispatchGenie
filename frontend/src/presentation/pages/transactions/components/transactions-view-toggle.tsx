"use client";

import { IoList, IoStatsChart } from "react-icons/io5";

export type ViewMode = "normal" | "total";

type TransactionsViewToggleProps = {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
};

export default function TransactionsViewToggle({
  viewMode,
  onChange,
}: TransactionsViewToggleProps) {
  return (
    <div className="flex items-center overflow-hidden rounded-md border border-gray-300">
      <button
        onClick={() => onChange("normal")}
        className={`flex items-center gap-2 border-r border-gray-300 px-4 py-1.5 text-sm transition-colors ${
          viewMode === "normal"
            ? "bg-gray-800 text-white"
            : "bg-white text-gray-700 hover:bg-gray-50"
        }`}
      >
        <IoList className="size-4" />
        <span>Normal View</span>
      </button>
      <button
        onClick={() => onChange("total")}
        className={`flex items-center gap-2 px-4 py-1.5 text-sm transition-colors ${
          viewMode === "total"
            ? "bg-gray-800 text-white"
            : "bg-white text-gray-700 hover:bg-gray-50"
        }`}
      >
        <IoStatsChart className="size-4" />
        <span>Total View</span>
      </button>
    </div>
  );
}
