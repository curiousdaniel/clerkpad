import { withAuth } from "next-auth/middleware";
import { resolveAuthSecret } from "@/lib/auth/secret";

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
      return !!token;
    },
  },
});

export const config = {
  matcher: [
    // Root path must be listed explicitly; some matchers skip `/` alone.
    "/",
    "/((?!login|register|forgot-password|reset-password|feedback|user-agreement|privacy-policy|api/auth|api/register|api/feedback|_next/static|_next/image|favicon.ico|manifest.json|offline.html|sw.js|icons|workbox).*)",
  ],
};
