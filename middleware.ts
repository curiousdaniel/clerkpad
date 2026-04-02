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
      if (path === "/") return true;
      return !!token;
    },
  },
});

export const config = {
  matcher: [
    // Root path must be listed explicitly; some matchers skip `/` alone.
    "/",
    "/((?!login|register|forgot-password|reset-password|api/auth|api/register|_next/static|_next/image|favicon.ico|manifest.json|offline.html|sw.js|icons|workbox).*)",
  ],
};
