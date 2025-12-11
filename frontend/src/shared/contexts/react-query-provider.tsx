"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";

const DEFAULT_OPTIONS = {
  queries: {
    refetchOnWindowFocus: false,
    retry: 1,
    staleTime: 1000 * 30,
  },
  mutations: {
    retry: 1,
  },
};

export function ReactQueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: DEFAULT_OPTIONS,
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
