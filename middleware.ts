import { withAuth } from "next-auth/middleware";
import { resolveAuthSecret } from "@/lib/auth/secret";
import {
  canAccessAdminArea,
  canAccessAdminRevertApi,
} from "@/lib/auth/superAdmin";

export default withAuth({
  secret: resolveAuthSecret(),
  pages: {
    signIn: "/login/",
  },
  callbacks: {
    authorized({ req, token }) {
      const path = req.nextUrl.pathname.replace(/\/$/, "") || "/";
      if (
        path === "/" ||
        path === "/user-agreement" ||
        path === "/privacy-policy" ||
        path === "/feedback"
      ) {
        return true;
      }
      if (path === "/admin" || path.startsWith("/api/admin")) {
        if (path === "/api/admin/revert" || path.startsWith("/api/admin/revert/")) {
          return canAccessAdminRevertApi(token);
        }
        return canAccessAdminArea(token);
      }
      return !!token;
    },
  },
});

export const config = {
  matcher: [
    // Root path must be listed explicitly; some matchers skip `/` alone.
    "/",
    "/((?!login|register|forgot-password|reset-password|feedback|user-agreement|privacy-policy|api/auth|api/register|api/feedback|api/sync|api/cron|_next/static|_next/image|favicon.ico|manifest.json|offline.html|sw.js|icons|workbox).*)",
  ],
};
