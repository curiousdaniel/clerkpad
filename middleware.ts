import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login/",
  },
  callbacks: {
    authorized: ({ token }) => !!token,
  },
});

export const config = {
  matcher: [
    // Root path must be listed explicitly; some matchers skip `/` alone.
    "/",
    "/((?!login|register|api/auth|api/register|_next/static|_next/image|favicon.ico|manifest.json|offline.html|sw.js|icons|workbox).*)",
  ],
};
