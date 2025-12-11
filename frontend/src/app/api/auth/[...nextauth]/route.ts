import { handlers } from "~/auth";

export const { GET, POST } = handlers;

// Explicitly set Node.js runtime for NextAuth compatibility
export const runtime = "nodejs";
