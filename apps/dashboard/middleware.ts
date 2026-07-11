import { NextRequest, NextResponse } from "next/server";

/**
 * Dashboard API auth middleware.
 * Restricts API access to localhost when DASHBOARD_SECRET is not set,
 * or validates the token when it is.
 */
export function middleware(req: NextRequest) {
  const secret = process.env.DASHBOARD_SECRET;

  // If a secret is configured, require it in Authorization header
  if (secret) {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (token !== secret) {
      // Also allow the X-Dashboard-Token header
      const altToken = req.headers.get("x-dashboard-token");
      if (altToken !== secret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
    return NextResponse.next();
  }

  // No secret configured: restrict to localhost only
  const forwarded = req.headers.get("x-forwarded-for");
  const host = req.headers.get("host") ?? "";
  const isLocal =
    host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.startsWith("[::1]") || !forwarded;

  if (!isLocal) {
    return NextResponse.json(
      { error: "Dashboard API is restricted to localhost. Set DASHBOARD_SECRET to enable remote access." },
      { status: 403 }
    );
  }

  return NextResponse.next();
}

// Only protect API routes, not page renders
export const config = {
  matcher: "/api/:path*",
};
