import { NextResponse } from "next/server";
import { auth } from "./auth";

enum UserRole {
  ADMIN = "ADMIN",
  ACCOUNTANT = "ACCOUNTANT",
  LOGISTIC_WORKER = "LOGISTIC_WORKER",
  SECURITY = "SECURITY",
}

interface RouteConfig {
  path: string;
  config: {
    isPublic?: boolean;
    redirect?: boolean;
    roles?: UserRole[];
  };
}

// Fallback routes for error scenarios
const ERROR_ROUTES = {
  UNAUTHORIZED: "/unauthorized",
  NOT_FOUND: "/404",
  SERVER_ERROR: "/500",
  DEFAULT_REDIRECT: "/login",
  DEFAULT_AUTHENTICATED_REDIRECT: "/sales-orders",
};

const routeConfigs: RouteConfig[] = [
  { path: "/", config: { isPublic: true } },
  {
    path: "/login",
    config: {
      isPublic: true,
      redirect: true,
    },
  },
  // Error pages - must be public to avoid redirect loops
  { path: "/404", config: { isPublic: true } },
  { path: "/500", config: { isPublic: true } },
  { path: "/unauthorized", config: { isPublic: true } },
  {
    path: "/sales-orders",
    config: {
      roles: [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.LOGISTIC_WORKER],
    },
  },
  {
    path: "/vehicles",
    config: {
      roles: [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.LOGISTIC_WORKER],
    },
  },
  {
    path: "/payments",
    config: {
      roles: [UserRole.ADMIN, UserRole.ACCOUNTANT],
    },
  },
  {
    path: "/transactions",
    config: {
      roles: [UserRole.ADMIN, UserRole.ACCOUNTANT],
    },
  },
  {
    path: "/beneficiary",
    config: {
      roles: [UserRole.ADMIN, UserRole.ACCOUNTANT],
    },
  },
  {
    path: "/invoices",
    config: {
      roles: [UserRole.ADMIN],
    },
  },
  {
    path: "/gate",
    config: {
      roles: [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.LOGISTIC_WORKER, UserRole.SECURITY],
    },
  },
  {
    path: "/users",
    config: {
      roles: [UserRole.ADMIN],
    },
  },
];

/**
 * Improved route matcher that handles path parameters
 * @param path The actual URL path
 * @param pattern The route pattern to match against
 * @returns Whether the path matches the pattern
 */
const matchRoute = (path: string, pattern: string): boolean => {
  // Normalize paths
  const normalizedPath = path.endsWith("/") ? path.slice(0, -1) : path;
  const normalizedPattern = pattern.endsWith("/") ? pattern.slice(0, -1) : pattern;

  if (normalizedPattern === normalizedPath) return true;

  const pathParts = normalizedPath.split("/").filter(Boolean);
  const patternParts = normalizedPattern.split("/").filter(Boolean);

  // If lengths don't match and there are no wildcards, no match
  if (pathParts.length !== patternParts.length) return false;

  // Check each part
  return patternParts.every((part, index) => {
    // If it's a parameter (starts with :), it matches anything
    if (part.startsWith(":")) return true;
    // Otherwise, it must match exactly
    return part === pathParts[index];
  });
};

/**
 * Get the configuration for a given path
 * @param path The URL path
 * @returns The route configuration, or null if not found
 */
const getRouteConfig = (path: string): RouteConfig["config"] | null => {
  const matchedRoute = routeConfigs.find((route) => matchRoute(path, route.path));
  return matchedRoute ? matchedRoute.config : null;
};

const safeCallbackDestination = (request: any) => {
  const callbackUrl = request.nextUrl.searchParams.get("callbackUrl");
  if (!callbackUrl) return null;
  if (!callbackUrl.startsWith("/") || callbackUrl.startsWith("//")) {
    return null;
  }
  return callbackUrl;
};

const redirectTo = (path: string, request: any, options?: { withCallback?: boolean }) => {
  const target = new URL(path, request.url);
  if (options?.withCallback) {
    const callbackPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    target.searchParams.set("callbackUrl", callbackPath);
  }
  return NextResponse.redirect(target);
};

/**
 * Main middleware function
 */
export default auth(async (request) => {
  try {
    const { pathname } = request.nextUrl;
    const routeConfig = getRouteConfig(pathname);

    // Safe type assertion with defaults
    const user = request.auth?.user as any;
    const token = user?.token;
    const userRole = user?.user?.role as UserRole | undefined;
    const isAuthenticated = Boolean(request.auth && token);
    const pendingCallbackDestination = safeCallbackDestination(request);

    // If no matching route found, allow Next.js to handle it (will show 404 if route doesn't exist)
    if (!routeConfig) {
      return NextResponse.next();
    }

    // Handle public routes
    if (routeConfig.isPublic) {
      if (routeConfig.redirect && isAuthenticated) {
        return redirectTo(
          pendingCallbackDestination ?? ERROR_ROUTES.DEFAULT_AUTHENTICATED_REDIRECT,
          request,
        );
      }
      return NextResponse.next();
    }

    // Require authentication for protected routes
    if (!isAuthenticated) {
      return redirectTo(ERROR_ROUTES.DEFAULT_REDIRECT, request, { withCallback: true });
    }

    // Enforce role-based access if roles are configured
    if (routeConfig.roles?.length) {
      if (!userRole) {
        return redirectTo(ERROR_ROUTES.UNAUTHORIZED, request);
      }

      const allowedRoles = new Set(routeConfig.roles);
      if (!allowedRoles.has(userRole)) {
        return redirectTo(ERROR_ROUTES.UNAUTHORIZED, request);
      }
    }

    // Allow the request to proceed
    return NextResponse.next();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Middleware error:", error);
    // Redirect to login on error for safety
    return NextResponse.redirect(new URL(ERROR_ROUTES.SERVER_ERROR, request.url));
  }
});

// Configure which paths this middleware will run on
export const config = {
  matcher: [
    /*
     * Match all paths except for:
     * 1. /api/auth routes (handled by next-auth)
     * 2. /_next (Next.js internals)
     * 3. /static (static files)
     * 4. all files in the public folder (images, fonts, etc.)
     * 5. favicon.ico, robots.txt, sitemap.xml
     */
    "/((?!api/auth|_next|static|.*\\..*|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
