// types/next-auth.d.ts
import type { DefaultSession } from "next-auth";
import type { UserRole } from "@/models/User";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      role: UserRole;
      position: string;
    } & DefaultSession["user"];
  }

  interface User {
    username: string;
    role: UserRole;
    position: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username: string;
    role: UserRole;
    position: string;
  }
}