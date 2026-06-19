import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export type UserRole = "admin" | "corretor" | "colaborador" | "cliente";

interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  creci?: string;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const usuario = await prisma.usuario.findUnique({
          where: { email: credentials.email as string },
        });

        if (!usuario || !usuario.ativo) return null;

        const senhaOk = await bcrypt.compare(
          credentials.password as string,
          usuario.senha
        );
        if (!senhaOk) return null;

        return {
          id: usuario.id,
          name: usuario.nome,
          email: usuario.email,
          role: usuario.papel as UserRole,
          creci: usuario.creci ?? undefined,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as AppUser).role;
        token.creci = (user as AppUser).creci;
        token.name = user.name;
        token.email = user.email;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as unknown as AppUser & { id: string }).role = token.role as UserRole;
        (session.user as unknown as AppUser).creci = token.creci as string | undefined;
        session.user.name = token.name as string;
        session.user.email = token.email as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
});
