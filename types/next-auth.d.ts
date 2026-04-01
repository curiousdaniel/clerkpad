import "next-auth";
import { DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      vendorId: string;
    };
    expires: string;
  }

  interface User {
    id: string;
    vendorId: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    vendorId?: string;
  }
}
