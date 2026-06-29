import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: "admin" | "corretor" | "colaborador" | "cliente";
      creci?: string;
      corretorId?: string;
      leadId?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    creci?: string;
    corretorId?: string;
    leadId?: string;
  }
}
