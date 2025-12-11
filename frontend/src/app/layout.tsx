import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  AuthSessionProvider,
  BuildProvidersTree,
  ReactQueryProvider,
  SidebarProvider,
  SnackbarProvider,
} from "~/shared/contexts";
import "~/styles/globals.scss";

export const metadata: Metadata = {
  title: "LogisticsPro",
  description: "Logistics productivity platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const ProvidersTree = BuildProvidersTree([
    [AuthSessionProvider],
    [ReactQueryProvider],
    [SnackbarProvider],
    [SidebarProvider],
  ]);

  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/images/favicon.png" type="image/png" />
      </head>
      <body>
        <ProvidersTree>
          <main>{children}</main>
        </ProvidersTree>
      </body>
    </html>
  );
}
