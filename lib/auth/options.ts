import type { NextAuthOptions } from "next-auth";
import type { User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db/postgres";
import { resolveAuthSecret } from "@/lib/auth/secret";
import { isSuperAdminUserRow } from "@/lib/auth/superAdmin";
import { hashImpersonationToken } from "@/lib/admin/impersonationToken";

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
    CredentialsProvider({
      id: "admin-impersonate",
      name: "Admin impersonate",
      credentials: {
        impersonationToken: { label: "Token", type: "text" },
      },
      async authorize(credentials) {
        const raw = credentials?.impersonationToken?.trim();
        if (!raw) return null;

        const tokenHash = hashImpersonationToken(raw);

        try {
          const { rows: tokRows } = await sql<{
            id: number;
            created_by_user_id: number;
            subject_user_id: number;
          }>`
            SELECT id, created_by_user_id, subject_user_id
            FROM admin_impersonation_tokens
            WHERE token_hash = ${tokenHash}
              AND used_at IS NULL
              AND expires_at > NOW()
            LIMIT 1
          `;
          const row = tokRows[0];
          if (!row) return null;

          await sql`
            UPDATE admin_impersonation_tokens
            SET used_at = NOW()
            WHERE id = ${row.id} AND used_at IS NULL
          `;

          const { rows: userRows } = await sql<{
            id: number;
            email: string;
            first_name: string;
            last_name: string;
            vendor_id: number;
          }>`
            SELECT id, email, first_name, last_name, vendor_id
            FROM users
            WHERE id = ${row.subject_user_id}
            LIMIT 1
          `;
          const subject = userRows[0];
          if (!subject) return null;

          const displayName =
            `${subject.first_name} ${subject.last_name}`.trim() ||
            subject.email;

          const base: User = {
            id: String(subject.id),
            email: subject.email,
            name: displayName,
            vendorId: String(subject.vendor_id),
          };

          if (isSuperAdminUserRow(subject)) {
            return base;
          }

          return {
            ...base,
            impersonatedBy: String(row.created_by_user_id),
          };
        } catch {
          return null;
        }
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
        if (user.impersonatedBy) {
          token.impersonatedBy = user.impersonatedBy;
        } else {
          delete token.impersonatedBy;
        }
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
      if (token.impersonatedBy) {
        session.impersonatedByUserId = token.impersonatedBy as string;
      } else {
        delete session.impersonatedByUserId;
      }
      return session;
    },
  },
  secret: resolveAuthSecret(),
};
