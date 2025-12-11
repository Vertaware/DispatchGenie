"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import type { AuthUser } from "~/domain/entities/auth";

export interface LoginPayload {
  token: string;
  tenantSlug: string;
  user: AuthUser;
}

export default function useAuth() {
  const { data: session, status } = useSession();

  const login = async ({ token, tenantSlug, user }: LoginPayload) => {
    const result = await signIn("credentials", {
      redirect: false,
      data: JSON.stringify({ token, tenantSlug, user }),
    });

    if (result?.error) {
      throw new Error(result.error);
    }
  };

  const logout = async (callbackUrl?: string) => {
    const logoutUrl = callbackUrl
      ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
      : "/login";
    await signOut({ redirect: true, callbackUrl: logoutUrl });
  };

  return {
    login,
    logout,
    status,
    session,
    user: session?.user ?? null,
  };
}
