import NextAuth, { NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { env } from "./env";

const MAX_AGE = 23 * 60 * 60; // Max Age is 23 Hours

/* Next Auth Config */
const authConfig: NextAuthConfig = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        data: { label: "object", type: "object" },
      },
      authorize: async (credentials: any) => {
        if (credentials.data) {
          const parsedData = JSON.parse(credentials.data);
          return {
            id: parsedData.email || "",
            ...parsedData,
          };
        }
        return null;
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user, trigger, session }: any) => {
      /* If User Has An Error, Sign Out */
      if (token && token.error) {
        return null;
      }

      /* User Will Trigger, When First Time Login */
      if (user) {
        token = { ...user, accessTokenExpires: Date.now() + MAX_AGE * 1000 };
      }

      /* Token Update From Both Client & Server */
      if (trigger === "update") {
        token = { ...session.user };
      }

      /* Access Token Has Expired, Try To Update It */
      if (token?.accessTokenExpires && Date.now() >= token.accessTokenExpires) {
        return null;
      }

      /* Return Previous Token If The Access Token Has Not Expired Yet */
      return token;
    },
    session: async ({ session, token }: any) => {
      session.user = token;
      return session;
    },
  },
  jwt: {
    maxAge: MAX_AGE,
  },
  session: {
    strategy: "jwt",
    maxAge: MAX_AGE,
  },
  pages: {
    signIn: "/login",
    signOut: "/",
  },
  secret: env.NEXT_PUBLIC_AUTH_SECRET,
  trustHost: true,
};

export const { handlers, signIn, signOut, auth, unstable_update } = NextAuth(authConfig);
