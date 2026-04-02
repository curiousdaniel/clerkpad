import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db/postgres";
import { resolveAuthSecret } from "@/lib/auth/secret";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/login/",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;
        if (!email || !password) return null;

        const { rows } = await sql<{
          id: number;
          email: string;
          password_hash: string;
          first_name: string;
          last_name: string;
          vendor_id: number;
        }>`
          SELECT id, email, password_hash, first_name, last_name, vendor_id
          FROM users
          WHERE email = ${email}
          LIMIT 1
        `;

        const user = rows[0];
        if (!user) return null;

        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) return null;

        const displayName =
          `${user.first_name} ${user.last_name}`.trim() || user.email;

        return {
          id: String(user.id),
          email: user.email,
          name: displayName,
          vendorId: String(user.vendor_id),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.vendorId = user.vendorId;
        token.email = user.email;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.vendorId = (token.vendorId as string) ?? "";
        session.user.email = token.email as string;
        session.user.name = token.name as string | null;
      }
      return session;
    },
  },
  secret: resolveAuthSecret(),
};
