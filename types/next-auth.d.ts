import "next-auth";
import { DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      vendorId: string;
      /** admin | clerk | cashier */
      orgRole: string;
    };
    expires: string;
    /** Present when super admin is signed in as another user. */
    impersonatedByUserId?: string;
  }

  interface User {
    id: string;
    vendorId: string;
    orgRole: string;
    /** Set by admin-impersonate provider when acting as a non-admin user. */
    impersonatedBy?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    vendorId?: string;
    orgRole?: string;
    /** Super-admin user id who started impersonation. */
    impersonatedBy?: string;
  }
}
